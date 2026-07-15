import { createApp } from './app'
import { config } from './config'

const app = createApp()

app.listen(config.port, () => {
  console.log(`أسطول المسافر API يعمل على http://localhost:${config.port}`)
})
