import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca rota acessível sem JWT (login, health, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
