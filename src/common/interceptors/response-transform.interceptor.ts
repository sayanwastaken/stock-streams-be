import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => {
        // If the response already has the expected format, return as is
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'message' in data
        ) {
          return {
            ...data,
            timestamp: new Date().toISOString(),
            path: request.url,
          };
        }

        // Otherwise, wrap the response in our standard format
        return {
          statusCode: context.switchToHttp().getResponse().statusCode || 200,
          message: 'Success',
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
