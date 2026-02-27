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
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL = 'https://uhlgimnmfifmrxraorrl.supabase.co/storage/v1/object/public/email-assets/geologistick-logo.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirmá tu email en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Geologistick" width="180" height="auto" style={logo} />
        <Heading style={h1}>Confirmá tu email</Heading>
        <Text style={text}>
          ¡Gracias por registrarte en{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Confirmá tu dirección de email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) haciendo clic en el botón:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verificar Email
        </Button>
        <Text style={footer}>
          Si no creaste una cuenta, podés ignorar este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1E293B', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748B', lineHeight: '1.6', margin: '0 0 25px' }
const link = { color: '#3B82F6', textDecoration: 'underline' }
const button = { backgroundColor: '#3B82F6', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94A3B8', margin: '30px 0 0' }
