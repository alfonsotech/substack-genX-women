# Substack Philosophers Alliance

A minimalist content aggregator for philosophy-focused Substack publications. This project aggregates RSS feeds from various philosophy-focused Substack newsletters and presents them in a clean, searchable interface.

## Features

- View a list of philosophy-focused Substack publications
- Browse a chronological feed of recent posts
- Search posts by title, subtitle, or author
- Infinite scroll for seamless browsing
- Responsive design for mobile and desktop

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Data Storage**: File-based JSON storage (no database required)
- **Feed Processing**: RSS Parser

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/substack-philosophers-alliance.git
   cd substack-philosophers-alliance
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the server
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Development

To run the server with hot reloading:
```
npm run dev
```

## How It Works

1. The server fetches RSS feeds from configured Substack publications
2. Feeds are parsed, normalized, and stored in JSON files
3. A background job refreshes feeds every 30 minutes
4. The frontend displays posts in a clean, searchable interface

## License

MIT
```

### 10. Running the Application

Now you can run the application with:

```bash
npm install
npm start