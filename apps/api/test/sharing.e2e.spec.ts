import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Phase C: per-collection sharing (Drive model), publication, and saves.
describe('Sharing, publication, and saves (e2e)', () => {
  let app: INestApplication<App>;
  let owner: string;
  let collaborator: string;
  const sfx = Date.now().toString(36);
  const ownerName = `own_${sfx}`;
  const collabName = `col_${sfx}`;
  const collabEmail = `col_${sfx}@example.com`;

  const signUp = async (name: string, email: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-up/email')
      .send({ email, password: 'Password123!', name, username: name })
      .expect(200);
    return res.headers['set-auth-token'];
  };

  const createCollection = async (
    bearer: string,
    slug: string,
    published = false,
  ) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ slug, title: slug, published })
      .expect(201);
    return (res.body as { data: { id: string } }).data.id;
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();

    owner = await signUp(ownerName, `${ownerName}@example.com`);
    collaborator = await signUp(collabName, collabEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reader can read but not write; editor can write but not manage', async () => {
    const server = app.getHttpServer();
    const id = await createCollection(owner, `shared-${sfx}`);
    await request(server)
      .post(`/api/v1/collections/${id}/resources/external`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ url: `https://example.com/s-${sfx}`, position: 0 })
      .expect(201);

    // Share as reader.
    await request(server)
      .post(`/api/v1/collections/${id}/shares`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ email: collabEmail, role: 'reader' })
      .expect(201);

    // Reader reads.
    await request(server)
      .get(`/api/v1/collections/${id}/resources`)
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(200);
    // Reader cannot write.
    await request(server)
      .post(`/api/v1/collections/${id}/resources/external`)
      .set('Authorization', `Bearer ${collaborator}`)
      .send({ url: `https://example.com/s2-${sfx}`, position: 1 })
      .expect(403);

    // Promote to editor.
    await request(server)
      .post(`/api/v1/collections/${id}/shares`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ email: collabEmail, role: 'editor' })
      .expect(201);

    // Editor writes content.
    await request(server)
      .post(`/api/v1/collections/${id}/resources/external`)
      .set('Authorization', `Bearer ${collaborator}`)
      .send({ url: `https://example.com/s3-${sfx}`, position: 1 })
      .expect(201);
    // Editor cannot publish or manage shares.
    await request(server)
      .post(`/api/v1/collections/${id}/publish`)
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(403);
    await request(server)
      .post(`/api/v1/collections/${id}/shares`)
      .set('Authorization', `Bearer ${collaborator}`)
      .send({ email: `${ownerName}@example.com`, role: 'reader' })
      .expect(403);

    // The collection shows up on the collaborator's shared/ surface.
    const shared = await request(server)
      .get('/api/v1/me/shared')
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(200);
    const sharedBody = shared.body as { data: Array<{ id: string }> };
    expect(sharedBody.data.some((c) => c.id === id)).toBe(true);
  });

  it('link rotation cuts off previously valid tokens', async () => {
    const server = app.getHttpServer();
    const id = await createCollection(owner, `link-${sfx}`);

    const first = await request(server)
      .put(`/api/v1/collections/${id}/link-sharing`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ enabled: true })
      .expect(200);
    const token = (first.body as { data: { token: string } }).data.token;

    await request(server)
      .get(`/api/v1/collections/${id}/resources?s=${token}`)
      .expect(200);

    await request(server)
      .put(`/api/v1/collections/${id}/link-sharing`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ enabled: true, rotate: true })
      .expect(200);

    // Old token no longer works.
    await request(server)
      .get(`/api/v1/collections/${id}/resources?s=${token}`)
      .expect(404);
  });

  it('saves require publication and go dormant on unpublish', async () => {
    const server = app.getHttpServer();
    const id = await createCollection(owner, `save-${sfx}`, true);

    // Saving a published collection works.
    await request(server)
      .post(`/api/v1/collections/${id}/save`)
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(201);

    let saved = await request(server)
      .get('/api/v1/me/saved')
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(200);
    let savedItem = (
      saved.body as { data: Array<{ id: string; available: boolean }> }
    ).data.find((c) => c.id === id);
    expect(savedItem?.available).toBe(true);

    // Unpublish -> the save stays listed but dormant.
    await request(server)
      .post(`/api/v1/collections/${id}/unpublish`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(201);

    saved = await request(server)
      .get('/api/v1/me/saved')
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(200);
    savedItem = (
      saved.body as { data: Array<{ id: string; available: boolean }> }
    ).data.find((c) => c.id === id);
    expect(savedItem?.available).toBe(false);

    // Saving an unpublished collection is rejected.
    const other = await createCollection(owner, `save2-${sfx}`);
    await request(server)
      .post(`/api/v1/collections/${other}/save`)
      .set('Authorization', `Bearer ${collaborator}`)
      .expect(400);
  });
});
