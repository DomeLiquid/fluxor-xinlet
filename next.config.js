/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_CLIENT_ID: process.env.NEXT_PUBLIC_CLIENT_ID,
    MIXIN_CLIENT_ID: process.env.MIXIN_CLIENT_ID,
    MIXIN_SESSION_ID: process.env.MIXIN_SESSION_ID,
    MIXIN_SERVER_PUBLIC_KEY: process.env.MIXIN_SERVER_PUBLIC_KEY,
    MIXIN_SESSION_PRIVATE_KEY: process.env.MIXIN_SESSION_PRIVATE_KEY,
    MIXIN_REFER_USER_ID: process.env.MIXIN_REFER_USER_ID,
  },
}

module.exports = nextConfig