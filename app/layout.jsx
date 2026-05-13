import './globals.css';

export const metadata = {
  title: 'Dashboard Cabify',
  description: 'Análisis de viajes Cabify por CC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
