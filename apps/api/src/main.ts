import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle("NSLinkHub API")
    .setDescription(
      "NSLinkHub HTTP API (v1). Browsers authenticate with better-auth cookie " +
        "sessions; API clients and the extension use bearer tokens.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addCookieAuth("better-auth.session_token")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("/api/docs", app, document);

  // 4000 by default: 3000 belongs to the web app (Next.js dev default). The
  // web fronts the API same-origin (path-routed /api/*), so there is no CORS.
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
