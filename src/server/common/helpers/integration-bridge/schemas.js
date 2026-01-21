import Joi from 'joi'

export const TokenResponseSchema = Joi.object({
  access_token: Joi.string().required(),
  expires_in: Joi.number().integer().positive().required()
}).unknown(true)

export const FindUserResponseSchema = Joi.object({
  data: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required()
      }).unknown(true)
    )
    .required(),
  links: Joi.object({
    self: Joi.string()
  })
    .unknown(true)
    .optional()
}).unknown(true)
