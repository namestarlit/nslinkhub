import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Regression tests for route shadowing: a catch-all GET ':owner/:slug' under
// /repositories used to swallow GET ':id/entries' and GET ':id/children'.
describe('Repository routes (e2e)', () => {
  let app: INestApplication<App>;
  let bearer: string;
  let repoId: string;

  const sfx = Date.now().toString(36);
  const username = `e2e_${sfx}`;
  const slug = `e2e-repo-${sfx}`;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();

    const server = app.getHttpServer();

    const signUp = await request(server)
      .post('/api/v1/auth/sign-up/email')
      .send({
        email: `${username}@example.com`,
        password: 'Password123!',
        name: username,
        username,
      })
      .expect(200);
    bearer = signUp.headers['set-auth-token'];
    expect(bearer).toBeTruthy();

    const repo = await request(server)
      .post('/api/v1/repositories')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ slug, title: 'E2E Repo', visibility: 'public' })
      .expect(201);
    repoId = (repo.body as { data: { id: string } }).data.id;

    await request(server)
      .post(`/api/v1/repositories/${repoId}/entries/external`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ url: `https://example.com/e2e-${sfx}`, position: 0 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists entries of a public repository unauthenticated', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/repositories/${repoId}/entries`)
      .expect(200);

    const body = res.body as { data: Array<{ url?: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].url).toContain(`e2e-${sfx}`);
  });

  // Canary for the shadowing regressing: a non-uuid id must be rejected by
  // the entries controller's ParseUUIDPipe (400), not swallowed by another
  // route as a 404.
  it('rejects a non-uuid repository id on the entries route with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/repositories/not-a-uuid/entries')
      .expect(400);
  });

  it('lists children of a public repository unauthenticated', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/repositories/${repoId}/children`)
      .expect(200);

    const body = res.body as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('looks up a repository by owner and slug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${username}/repositories/${slug}`)
      .expect(200);

    const body = res.body as { data: { slug: string } };
    expect(body.data.slug).toBe(slug);
  });
});
