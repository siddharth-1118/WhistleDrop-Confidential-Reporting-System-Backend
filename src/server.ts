import app from './app';
import { config } from './config/env';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🔒 WhistleDrop Backend API Server running on port ${PORT}`);
  console.log(`📄 OpenAPI/Swagger Docs: http://localhost:${PORT}/api-docs`);
  console.log(`====================================================`);
});
