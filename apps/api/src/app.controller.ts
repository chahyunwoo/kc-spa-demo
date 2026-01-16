import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return {
      sub: req.user.sub,
      preferred_username: req.user.preferred_username,
      email: req.user.email,
      roles: req.user.realm_access?.roles ?? [],
      raw: req.user,
    };
  }
}
