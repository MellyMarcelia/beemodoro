// The app's colours, fonts and basic styles.
import './assets/main.css'

// Vue (the toolkit that builds the screen) and our main screen.
import { createApp } from 'vue'
import App from './App.vue'

// Where the screen starts: put App.vue inside the empty "app" box in index.html.
createApp(App).mount('#app')
