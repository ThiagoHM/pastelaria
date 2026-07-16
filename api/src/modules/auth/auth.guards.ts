import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "../../database/entities";
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException();
    try {
      req.user = await this.jwt.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException("Sessão inválida");
    }
  }
}
export const Roles = (...roles: UserRole[]) => SetMetadata("roles", roles);
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.get<UserRole[]>("roles", ctx.getHandler());
    if (!roles) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!roles.includes(user?.role))
      throw new ForbiddenException("Acesso restrito ao administrador");
    return true;
  }
}
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
