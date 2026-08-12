import createApp from './app.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`API siap di http://localhost:${port}/api`);
});
