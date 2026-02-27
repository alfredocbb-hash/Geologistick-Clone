/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

const LOGO_URL = 'https://uhlgimnmfifmrxraorrl.supabase.co/storage/v1/object/public/email-assets/geologistick-logo.png'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Geologistick" width="180" height="auto" style={logo} />
        <Heading style={h1}>Confirmá tu identidad</Heading>
        <Text style={text}>Usá el siguiente código para confirmar tu identidad:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expirará en breve. Si no lo solicitaste, podés ignorar este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1E293B', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748B', lineHeight: '1.6', margin: '0 0 25px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#3B82F6', letterSpacing: '4px', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#94A3B8', margin: '30px 0 0' }
