import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { RefreshDto } from './dtos/refresh.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { GoogleLoginDto } from './dtos/google-login.dto';
import type { JwtUserPayload } from './jwt-user.payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  logoutAll(@Req() req: Request & { user: JwtUserPayload }) {
    return this.auth.logoutAll(req.user.sub);
  }

  /** Recuperação de senha é responsabilidade do IdP corporativo (ver docs/IDENTITY.md). */
  @Public()
  @Get('idp')
  idpConfig() {
    return this.auth.getIdpConfig();
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() _dto: ForgotPasswordDto) {
    return this.auth.forgotPassword();
  }

  @Post('change-password')
  changePassword(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
