import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { compare, hash } from "bcryptjs";
import { Repository } from "typeorm";
import { User } from "../../database/entities";

export class RegisterDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @IsNotEmpty() @MaxLength(120) fullName: string;
  @IsString() @MinLength(6) @MaxLength(128) password: string;
  @IsString() @IsNotEmpty() @MaxLength(20) phone: string;
  @IsString() @IsNotEmpty() @MaxLength(10) cep: string;
  @IsString() @IsNotEmpty() @MaxLength(160) street: string;
  @IsString() @IsNotEmpty() @MaxLength(20) number: string;
  @IsOptional() @IsString() @MaxLength(120) complement?: string;
}
export class LoginDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @IsNotEmpty() @MaxLength(128) password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
  ) {}
  async register(dto: RegisterDto) {
    if (await this.users.findOneBy({ email: dto.email.toLowerCase() }))
      throw new ForbiddenException("E-mail já cadastrado");
    const user = await this.users.save(
      this.users.create({
        ...dto,
        email: dto.email.toLowerCase(),
        passwordHash: await hash(dto.password, 12),
      }),
    );
    return this.issue(user);
  }
  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("LOWER(u.email)=LOWER(:email)", { email: dto.email })
      .getOne();
    if (!user || !(await compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException("E-mail ou senha inválidos");
    return this.issue(user);
  }
  private issue(user: User) {
    return {
      accessToken: this.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        cep: user.cep,
        street: user.street,
        number: user.number,
        complement: user.complement,
      },
    };
  }
}
