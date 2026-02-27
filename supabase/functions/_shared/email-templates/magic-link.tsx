/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

const LOGO_URL = 'https://uhlgimnmfifmrxraorrl.supabase.co/storage/v1/object/public/email-assets/geologistick-logo.png'

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu enlace de acceso a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Geologistick" width="180" height="auto" style={logo} />
        <Heading style={h1}>Tu enlace de acceso</Heading>
        <Text style={text}>
          Hacé clic en el botón para iniciar sesión en {siteName}. Este enlace expirará en breve.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Iniciar Sesión
        </Button>
        <Text style={footer}>
          Si no solicitaste este enlace, podés ignorar este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1E293B', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748B', lineHeight: '1.6', margin: '0 0 25px' }
const button = { backgroundColor: '#3B82F6', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94A3B8', margin: '30px 0 0' }
