// State
let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;
let currentSearch = "";
let philosophers = [];

// DOM Elements
const philosophersList = document.getElementById("philosophers-list");
const postsContainer = document.getElementById("posts-container");
const loadingElement = document.getElementById("loading");
const searchInput = document.getElementById("search-input");

// Check if we're running on Netlify (no Socket.io)
const isNetlify = window.location.hostname.includes("netlify.app");

// Only try to connect to Socket.io if not on Netlify
let socket;
if (!isNetlify && typeof io !== "undefined") {
  try {
    socket = io();
    socket.on("newContent", (data) => {
      console.log("New content available:", data);
      // Handle new content notification
    });
  } catch (error) {
    console.log("Socket.io connection failed:", error);
  }
}

// Function to show a notification when new content is available
function showNewContentNotification(data) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "new-content-notification";

  // Create notification content
  notification.innerHTML = `
    <div class="notification-content">
      <h3>New Content Available!</h3>
      <p>${data.count} new posts have been published.</p>
      <button class="refresh-button">Refresh Now</button>
      <button class="dismiss-button">Dismiss</button>
    </div>
  `;

  // Add to the DOM
  document.body.appendChild(notification);

  // Add event listeners
  notification
    .querySelector(".refresh-button")
    .addEventListener("click", () => {
      // Reset to page 1 and fetch fresh content
      currentPage = 1;
      fetchPosts(1, currentSearch);
      notification.remove();
    });

  notification
    .querySelector(".dismiss-button")
    .addEventListener("click", () => {
      notification.remove();
    });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 10000);
}

// Fetch philosophers
async function fetchPhilosophers() {
  try {
    const response = await fetch("/api/philosophers");
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    philosophers = await response.json();
    if (!Array.isArray(philosophers)) {
      console.error("Philosophers data is not an array:", philosophers);
      philosophers = []; // Ensure it's an array
    }

    // Sort philosophers alphabetically by name
    philosophers.sort((a, b) => a.name.localeCompare(b.name));

    renderPhilosophers();
  } catch (error) {
    console.error("Error fetching philosophers:", error);
    // Show error message to user
    philosophersList.innerHTML = `<li class="error">Failed to load philosophers. Please try again later.</li>`;
  }
}

// Render philosophers list
function renderPhilosophers() {
  philosophersList.innerHTML = philosophers
    .map((philosopher) => {
      const initial = philosopher.name.charAt(0).toUpperCase();
      return `
      <li class="philosopher-item">
        <div class="philosopher-logo-container">
          <img 
            src="/api/philosophers/${philosopher.id}/logo" 
            alt="${philosopher.name}" 
            class="philosopher-logo"
            onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 fill=%22%23f0f0f0%22 /><text x=%2212%22 y=%2216%22 font-size=%2214%22 text-anchor=%22middle%22 fill=%22%23333%22>${initial}</text></svg>'"
          >
        </div>
        <a href="${philosopher.substackUrl}" target="_blank" data-id="${philosopher.id}">
          ${philosopher.name}
        </a>
      </li>
    `;
    })
    .join("");
}

// Fetch posts with pagination and search
async function fetchPosts(page = 1, search = "") {
  if (isLoading || (!hasMorePosts && page > 1)) return;

  isLoading = true;
  loadingElement.style.display = "block";

  try {
    const url = new URL("/api/posts", window.location.origin);
    url.searchParams.append("page", page);
    url.searchParams.append("limit", 10);
    if (search) url.searchParams.append("search", search);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    // Ensure posts is an array
    const posts = Array.isArray(data.posts) ? data.posts : [];
    hasMorePosts = data.hasMore || false;

    renderPosts(posts, page === 1);
    currentPage = page;
  } catch (error) {
    console.error("Error fetching posts:", error);
    // Show error message to user
    if (currentPage === 1) {
      postsContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load posts. Please try again later.</p>
        </div>
      `;
    }
  } finally {
    isLoading = false;
    loadingElement.style.display = hasMorePosts ? "block" : "none";
  }
}

// Render posts
function renderPosts(posts, clearExisting = false) {
  if (clearExisting) {
    postsContainer.innerHTML = "";
  }

  if (posts.length === 0 && clearExisting) {
    postsContainer.innerHTML = `
      <div class="no-results">
        <p>No posts found${
          currentSearch ? ` matching "${currentSearch}"` : ""
        }.</p>
      </div>
    `;
    return;
  }

  const postsHTML = posts
    .map((post) => {
      const initial = post.title.charAt(0).toUpperCase();

      // Construct author profile URL if possible
      let authorProfileUrl = null;

      // Check if the post has a substackUrl property or if we can extract it from the post link
      if (post.substackUrl) {
        // If we have a direct Substack URL for the author
        authorProfileUrl = `https://substack.com/@${
          post.substackUrl.split("@")[1] ||
          post.author.toLowerCase().replace(/\s+/g, "")
        }`;
      } else if (post.link && post.link.includes("substack.com")) {
        // Try to extract the Substack domain from the post link
        const match = post.link.match(/https:\/\/(.*?)\.substack\.com/);
        if (match && match[1]) {
          // Construct the author profile URL using the Substack subdomain
          authorProfileUrl = `https://substack.com/@${match[1]}`;
        }
      }

      // Extract publication URL from the post link
      let publicationUrl = post.link;
      if (post.link && post.link.includes("substack.com")) {
        // Extract the base Substack URL (without the specific post path)
        const match = post.link.match(/(https:\/\/.*?\.substack\.com)/);
        if (match && match[1]) {
          publicationUrl = match[1];
        }
      }

      return `
      <article class="post-card">
        <div class="post-image-container">
          <a href="${post.link}" target="_blank">
            ${
              post.coverImage
                ? `<img src="${post.coverImage}" alt="${post.title}" class="post-image" 
                   onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2290%22 viewBox=%220 0 120 90%22><rect width=%22120%22 height=%2290%22 fill=%22%23f0f0f0%22 /><text x=%2260%22 y=%2245%22 font-size=%2224%22 text-anchor=%22middle%22 fill=%22%23333%22>${initial}</text></svg>'">`
                : `<div class="post-image-placeholder">
                 <svg width="120" height="90" viewBox="0 0 120 90">
                   <rect width="120" height="90" fill="#f0f0f0" />
                   <text x="60" y="45" font-size="24" text-anchor="middle" fill="#333">${initial}</text>
                 </svg>
               </div>`
            }
          </a>
        </div>
        <div class="post-content">
          <h2 class="post-title">
            <a href="${post.link}" target="_blank">${post.title}</a>
          </h2>
          <p class="post-subtitle">${post.subtitle || ""}</p>
          <div class="post-meta">
            <span>
              ${
                authorProfileUrl
                  ? `<a href="${authorProfileUrl}" target="_blank" class="author-link">${post.author}</a>`
                  : post.author
              } · 
              <a href="${publicationUrl}" target="_blank" class="publication-link">${
        post.publicationName
      }</a>
            </span>
            <span>${formatDate(post.publishDate)}</span>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  postsContainer.insertAdjacentHTML("beforeend", postsHTML);
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Infinite scroll handler
function handleScroll() {
  if (isLoading || !hasMorePosts) return;

  // Calculate scroll position
  const scrollPosition = window.innerHeight + window.scrollY;
  const bodyHeight = document.body.offsetHeight;

  // Load more posts when user scrolls to bottom (with 200px threshold)
  if (bodyHeight - scrollPosition < 200) {
    console.log("Loading more posts...", currentPage + 1);
    fetchPosts(currentPage + 1, currentSearch);
  }
}

// Search handler with debounce
let searchTimeout;
function handleSearch() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const searchTerm = searchInput.value.trim();

    // Only search if term has changed
    if (searchTerm !== currentSearch) {
      currentSearch = searchTerm;
      currentPage = 1;
      hasMorePosts = true;
      fetchPosts(1, currentSearch);
    }
  }, 300); // 300ms debounce
}

// Initialize app
function init() {
  // Fetch initial data
  fetchPhilosophers();
  fetchPosts(1);

  // Add event listeners
  window.addEventListener("scroll", handleScroll);
  searchInput.addEventListener("input", handleSearch);

  // Add keyboard shortcut for search focus (Ctrl+K or Cmd+K)
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// Start the app
init();
