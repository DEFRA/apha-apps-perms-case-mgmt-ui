import Joi from 'joi'

export const TokenResponseSchema = Joi.object({
  access_token: Joi.string().required(),
  expires_in: Joi.number().integer().positive().required()
}).unknown(true)
