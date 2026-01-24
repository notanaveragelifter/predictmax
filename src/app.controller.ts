import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getStatus() {
    return {
      name: 'PredictMax',
      version: '1.0.0',
      status: 'running',
      description: 'AI-Powered Prediction Market Intelligence Agent',
      endpoints: {
        rest: {
          markets: '/api/markets',
          trending: '/api/markets/trending',
          discover: '/api/markets/discover',
          analyze: '/api/markets/analyze/:platform/:marketId',
        },
        websocket: {
          chat: '/chat',
          events: ['message', 'join_conversation', 'list_conversations'],
        },
      },
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
