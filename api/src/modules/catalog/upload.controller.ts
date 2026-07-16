import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { UserRole } from "../../database/entities";
import { JwtGuard, Roles, RolesGuard } from "../auth/auth.guards";

@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/uploads")
export class UploadController {
  @Post("product-image")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: diskStorage({
        destination: "uploads",
        filename: (_, file, callback) =>
          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`,
          ),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_, file, callback) =>
        file.mimetype.startsWith("image/")
          ? callback(null, true)
          : callback(
              new BadRequestException("Envie um arquivo de imagem"),
              false,
            ),
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Imagem não recebida");
    const apiUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    return { imageUrl: `${apiUrl}/uploads/${file.filename}` };
  }
}
