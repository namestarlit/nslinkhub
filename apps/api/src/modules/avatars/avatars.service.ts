import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { renderAvatarSvg } from "./avatar-generator";

@Injectable()
export class AvatarsService {
  render(seed: string, size: number) {
    return {
      svg: renderAvatarSvg(seed, size),
      etag: `"${createHash("sha256").update(`avatar-v1\0${seed}\0${size}`).digest("hex")}"`,
    };
  }
}
