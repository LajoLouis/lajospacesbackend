import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { config } from './environment';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'LajoSpaces API',
    version: '1.0.0',
    description: `
      LajoSpaces is Nigeria's premier housing platform connecting property seekers with property owners and roommates.
      
      ## Features
      - **User Management**: Registration, authentication, and profile management
      - **Property Management**: Property listings, search, and favorites
      - **Roommate Matching**: Smart matching system for compatible roommates
      - **Messaging System**: Real-time communication between users
      - **Email & Notifications**: Comprehensive notification system
      - **Security & Performance**: Rate limiting, input validation, and caching
      
      ## Authentication
      Most endpoints require JWT authentication. Include the token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ## Rate Limiting
      API endpoints are rate-limited to ensure fair usage:
      - General endpoints: 1000 requests per 15 minutes
      - Authentication: 20 requests per 15 minutes
      - Password reset: 5 requests per hour
      - Email sending: 50 requests per hour
      
      ## Nigerian Market Focus
      This API is optimized for the Nigerian market with:
      - Nigerian phone number validation (+234 format)
      - Nigerian states and LGAs
      - Naira currency support
      - Africa/Lagos timezone
    `,
    contact: {
      name: 'LajoSpaces Support',
      email: 'support@lajospaces.com',
      url: 'https://lajospaces.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: config.NODE_ENV === 'production' ? 'https://api.lajospaces.com' : `http://localhost:${config.PORT}`,
      description: config.NODE_ENV === 'production' ? 'Production server' : 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from login endpoint'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            example: 'Error message'
          },
          code: {
            type: 'string',
            example: 'ERROR_CODE'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: 'Operation completed successfully'
          },
          data: {
            type: 'object',
            description: 'Response data'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          firstName: {
            type: 'string',
            example: 'John'
          },
          lastName: {
            type: 'string',
            example: 'Doe'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john.doe@example.com'
          },
          phoneNumber: {
            type: 'string',
            example: '+2348012345678'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin'],
            example: 'user'
          },
          emailVerified: {
            type: 'boolean',
            example: true
          },
          isActive: {
            type: 'boolean',
            example: true
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Property: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          title: {
            type: 'string',
            example: 'Beautiful 2-Bedroom Apartment'
          },
          description: {
            type: 'string',
            example: 'Spacious apartment in a serene environment'
          },
          type: {
            type: 'string',
            enum: ['apartment', 'house', 'room', 'studio', 'duplex', 'bungalow'],
            example: 'apartment'
          },
          price: {
            type: 'number',
            example: 120000
          },
          currency: {
            type: 'string',
            example: 'NGN'
          },
          location: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                example: 'Lagos'
              },
              lga: {
                type: 'string',
                example: 'Victoria Island'
              },
              address: {
                type: 'string',
                example: '123 Ahmadu Bello Way'
              },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: {
                    type: 'number',
                    example: 6.4281
                  },
                  longitude: {
                    type: 'number',
                    example: 3.4219
                  }
                }
              }
            }
          },
          amenities: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['parking', 'security', 'generator', 'water']
          },
          images: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri'
            }
          },
          owner: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          status: {
            type: 'string',
            enum: ['available', 'rented', 'pending'],
            example: 'available'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Notification: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          userId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          type: {
            type: 'string',
            enum: ['welcome', 'email_verified', 'new_match', 'new_message', 'property_posted'],
            example: 'new_match'
          },
          title: {
            type: 'string',
            example: 'New Roommate Match Found!'
          },
          message: {
            type: 'string',
            example: 'We found a potential roommate match for you.'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            example: 'high'
          },
          read: {
            type: 'boolean',
            example: false
          },
          dismissed: {
            type: 'boolean',
            example: false
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      PaginationResponse: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            example: 1
          },
          limit: {
            type: 'number',
            example: 20
          },
          total: {
            type: 'number',
            example: 100
          },
          pages: {
            type: 'number',
            example: 5
          },
          hasMore: {
            type: 'boolean',
            example: true
          }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Authentication required',
              code: 'UNAUTHORIZED',
              timestamp: '2024-01-01T00:00:00.000Z'
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Insufficient permissions',
              code: 'FORBIDDEN',
              timestamp: '2024-01-01T00:00:00.000Z'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Resource not found',
              code: 'NOT_FOUND',
              timestamp: '2024-01-01T00:00:00.000Z'
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Validation failed',
              code: 'VALIDATION_ERROR',
              timestamp: '2024-01-01T00:00:00.000Z'
            }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/Error' },
                {
                  type: 'object',
                  properties: {
                    retryAfter: {
                      type: 'string',
                      example: '15 minutes'
                    }
                  }
                }
              ]
            },
            example: {
              success: false,
              error: 'Too many requests, please try again later',
              retryAfter: '15 minutes',
              timestamp: '2024-01-01T00:00:00.000Z'
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Users',
      description: 'User management operations'
    },
    {
      name: 'Properties',
      description: 'Property listing and management'
    },
    {
      name: 'Search',
      description: 'Property and user search functionality'
    },
    {
      name: 'Matches',
      description: 'Roommate matching system'
    },
    {
      name: 'Messages',
      description: 'Messaging and communication'
    },
    {
      name: 'Notifications',
      description: 'Notification management'
    },
    {
      name: 'Emails',
      description: 'Email services and templates'
    },
    {
      name: 'Uploads',
      description: 'File upload operations'
    },
    {
      name: 'Admin',
      description: 'Administrative operations'
    }
  ]
};

// Options for swagger-jsdoc
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/models/*.ts'
  ]
};

// Generate swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info .title { color: #2563eb; }
  .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px; }
  .swagger-ui .info .description { font-size: 14px; line-height: 1.6; }
  .swagger-ui .btn.authorize { background-color: #2563eb; border-color: #2563eb; }
  .swagger-ui .btn.authorize:hover { background-color: #1d4ed8; border-color: #1d4ed8; }
`;

// Swagger UI options
const swaggerUiOptions = {
  customCss,
  customSiteTitle: 'LajoSpaces API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
};

/**
 * Setup Swagger documentation
 */
export function setupSwagger(app: Express): void {
  // Serve swagger documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Serve swagger JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`📚 Swagger documentation available at: http://localhost:${config.PORT}/api/docs`);
}

export { swaggerSpec };
export default { setupSwagger, swaggerSpec };
