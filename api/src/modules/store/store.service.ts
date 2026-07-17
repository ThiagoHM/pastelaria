import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Repository } from "typeorm";
import { StoreSettings } from "../../database/entities";
export class SettingsDto {
  @IsBoolean() isOpen: boolean;
  @IsNumber() @Min(0) deliveryFee: number;
  @IsOptional() @IsString() @MaxLength(160) message?: string;
}
@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreSettings) private repo: Repository<StoreSettings>,
  ) {}
  async get() {
    let settings = await this.repo.findOne({ where: {} });
    if (!settings) settings = await this.repo.save(this.repo.create());
    return { ...settings, deliveryFee: Number(settings.deliveryFee) };
  }
  async update(dto: SettingsDto) {
    const current = await this.get();
    return this.repo.save(this.repo.create({ ...current, ...dto }));
  }
}
