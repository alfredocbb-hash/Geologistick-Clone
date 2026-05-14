import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Clock, MessageCircle, HelpCircle, ChevronDown, Send, CheckCircle2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { SEO } from "@/components/seo/SEO";

const Support = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setIsSubmitted(true);
    toast.success("Mensaje enviado correctamente. Te responderemos pronto.");

    // Reset form after a delay
    setTimeout(() => {
      setFormData({ name: "", email: "", subject: "", message: "" });
      setIsSubmitted(false);
    }, 3000);
  };

  const faqs = [
    {
      question: "¿Cómo puedo rastrear mi envío?",
      answer:
        "Puedes rastrear tu envío ingresando el número de tracking en nuestra página de seguimiento. También recibirás actualizaciones automáticas por WhatsApp o email si el remitente ha proporcionado tus datos de contacto.",
    },
    {
      question: "¿Cómo conecto mi tienda de TiendaNube?",
      answer:
        "Desde el panel de administración, ve a Configuración > Integraciones y haz clic en 'Conectar TiendaNube'. Serás redirigido a TiendaNube para autorizar la conexión. Una vez autorizado, tus pedidos se sincronizarán automáticamente.",
    },
    {
      question: "¿Qué hago si mi paquete no llegó?",
      answer:
        "Primero verifica el estado en la página de tracking. Si muestra 'Entregado' pero no lo recibiste, contacta inmediatamente a soporte con el número de tracking. Investigaremos el caso y te ayudaremos a resolverlo.",
    },
    {
      question: "¿Cuáles son los horarios de entrega?",
      answer:
        "Los horarios de entrega son de lunes a viernes de 9:00 a 18:00. Para envíos especiales o entregas fuera de horario, consulta con tu empresa de logística.",
    },
    {
      question: "¿Cómo puedo cambiar la dirección de entrega?",
      answer:
        "Si el envío aún no está en camino, puedes solicitar el cambio de dirección contactando al remitente o a soporte. Una vez que el paquete está en reparto, las modificaciones pueden no ser posibles.",
    },
    {
      question: "¿Qué métodos de pago aceptan?",
      answer:
        "Aceptamos transferencia bancaria, MercadoPago, tarjetas de crédito/débito y efectivo contra entrega (según configuración del envío). Los métodos disponibles dependen de cada empresa de logística.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Soporte y centro de ayuda — Geologistick"
        description="Centro de ayuda de Geologistick: contacto, preguntas frecuentes sobre envíos, integraciones y entregas en Argentina."
        path="/support"
      />
      <Navbar />
      <main className="flex-1 py-16 md:py-24">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Centro de Soporte</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              ¿Necesitas ayuda? Estamos aquí para asistirte. Consulta nuestras preguntas frecuentes o contáctanos
              directamente.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Contact Cards */}
            <Card className="bg-card/50 hover:bg-card/70 transition-colors">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Email</h3>
                <a href="mailto:soporte@geologistick.com" className="text-primary hover:underline">
                  soporte@geologistick.com
                </a>
                <p className="text-muted-foreground text-sm mt-2">Respondemos en menos de 24 horas</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 hover:bg-card/70 transition-colors">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">WhatsApp</h3>
                <a
                  href="https://wa.me/5491151767139"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  +54 9 11 5176-7139
                </a>
                <p className="text-muted-foreground text-sm mt-2">Atención en tiempo real</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 hover:bg-card/70 transition-colors">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Horarios</h3>
                <p className="text-foreground">Lun - Vie: 9:00 - 18:00</p>
                <p className="text-muted-foreground text-sm mt-2"></p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Envíanos un Mensaje
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">¡Mensaje Enviado!</h3>
                    <p className="text-muted-foreground">Te responderemos lo antes posible.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                          id="name"
                          placeholder="Tu nombre"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="tu@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Asunto</Label>
                      <Input
                        id="subject"
                        placeholder="¿En qué podemos ayudarte?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Mensaje</Label>
                      <Textarea
                        id="message"
                        placeholder="Describe tu consulta con el mayor detalle posible..."
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar Mensaje
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* FAQs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Preguntas Frecuentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left text-sm">{faq.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-sm">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Support;
