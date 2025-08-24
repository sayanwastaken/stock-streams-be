import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    let validationErrors: any = {};

    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      // Transform class-validator errors into a more user-friendly format
      validationErrors = this.transformValidationErrors(
        exceptionResponse.message,
      );
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      validationErrors,
    };

    response.status(status).json(errorResponse);
  }

  private transformValidationErrors(
    errors: string[],
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    errors.forEach((error) => {
      // Extract field name and constraint from error message
      const matches = error.match(/^(\w+)\s+(.+)$/);
      if (matches) {
        const [, field, constraint] = matches;
        if (!result[field]) {
          result[field] = [];
        }
        result[field].push(constraint);
      } else {
        // If we can't parse the error, add it to a general errors array
        if (!result.general) {
          result.general = [];
        }
        result.general.push(error);
      }
    });

    return result;
  }
}
