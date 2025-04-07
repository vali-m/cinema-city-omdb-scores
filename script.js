// Replace with your OMDb API key
const OMDB_API_KEY = "YOUR_OMDB_API_KEY";

document.addEventListener("DOMContentLoaded", () => {
  // Default the date input to today's date (YYYY-MM-DD)
  const datePicker = document.getElementById("datePicker");
  const today = new Date().toISOString().split("T")[0];
  datePicker.value = today;

  document
    .getElementById("fetchMoviesBtn")
    .addEventListener("click", fetchMovies);
});

const CINEMA_NAMES = {
  '1823': 'Timisoara Shopping City',
  '1802': 'Timisoara Iulius Mall'
};

function formatAttributes(attributes) {
  // Map common attributes to user-friendly format
  const formatMap = {
    '2d': '2D',
    '3d': '3D',
    'imax': 'IMAX',
    'sub-en': 'Subtitles: English',
    'sub-ro': 'Subtitles: Romanian',
    'dubbed-ro': 'Dubbed: Romanian'
  };

  return attributes.map(attr => formatMap[attr.toLowerCase()] || attr).join(', ');
}

async function fetchMovies() {
  const moviesContainer = document.getElementById("moviesContainer");
  moviesContainer.innerHTML = "Loading...";

  // Get user inputs
  const cinemaIds = document
    .getElementById("cinemaIds")
    .value.split(",")
    .map(id => id.trim());
  const selectedDate = document.getElementById("datePicker").value;

  // We'll store all movie data in this object
  const allMovies = {};
  const uniqueMovieNames = new Set();

  // 1) Fetch from Cinema City for each cinema ID
  for (const cinemaId of cinemaIds) {
    const cinemaUrl = `/proxy/cinema-city?cinemaId=${cinemaId}&date=${selectedDate}`;

    try {
      const response = await fetch(cinemaUrl);
      if (!response.ok) {
        console.error(`Cinema City request failed for ID ${cinemaId}`);
        continue;
      }
      const data = await response.json();
      const films = data.body.films || [];
      const events = data.body.events || [];

      const filmMap = {};
      films.forEach(f => {
        filmMap[f.id] = f;
      });

      events.forEach(evt => {
        const filmId = evt.filmId;
        const film = filmMap[filmId];
        if (!film) return;

        const filmName = film.name;

        if (!allMovies[filmName]) {
          allMovies[filmName] = {
            name: filmName,
            length: film.length,
            timeslots: {},
            omdb: null,
          };
        }

        if (!allMovies[filmName].timeslots[cinemaId]) {
          allMovies[filmName].timeslots[cinemaId] = [];
        }

        const eventDate = new Date(evt.eventDateTime);
        const timeString = eventDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });

        allMovies[filmName].timeslots[cinemaId].push({
          time: timeString,
          attributes: evt.attributeIds || [],
        });

        uniqueMovieNames.add(filmName);
      });
    } catch (err) {
      console.error("Error fetching cinema data:", err);
    }
  }

  // 2) Fetch OMDb ratings for each unique movie
  for (const movieName of uniqueMovieNames) {
    try {
      const omdbUrl = `/proxy/omdb?title=${encodeURIComponent(movieName)}`;
      const omdbResponse = await fetch(omdbUrl);
      const omdbData = await omdbResponse.json();

      if (omdbData.Response === "True") {
        let rtRating = "N/A";
        if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
          const rtObj = omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes");
          if (rtObj) {
            rtRating = rtObj.Value;
          }
        }

        allMovies[movieName].omdb = {
          imdbRating: omdbData.imdbRating || "N/A",
          rtRating,
          year: omdbData.Year,
          plot: omdbData.Plot,
          poster: omdbData.Poster,
        };
      }
    } catch (err) {
      console.error("Error fetching OMDb data for:", movieName, err);
    }
  }

  // 3) Render everything in the DOM
  moviesContainer.innerHTML = "";
  const sortedMovieNames = Object.keys(allMovies).sort();

  sortedMovieNames.forEach(movieName => {
    const movieInfo = allMovies[movieName];
    const movieCard = document.createElement("div");
    movieCard.className = "movie-card";

    // Create the main content section
    const content = document.createElement("div");
    content.className = "movie-content";

    // Create the header section (poster + info)
    const header = document.createElement("div");
    header.className = "movie-header";

    // Add poster
    if (movieInfo.omdb?.poster && movieInfo.omdb.poster !== "N/A") {
      const poster = document.createElement("img");
      poster.src = movieInfo.omdb.poster;
      poster.alt = `${movieName} Poster`;
      poster.className = "movie-poster";
      header.appendChild(poster);
    }

    // Create info section
    const info = document.createElement("div");
    info.className = "movie-info";

    // Add title
    const title = document.createElement("h2");
    title.className = "movie-title";
    title.textContent = movieName;
    info.appendChild(title);

    // Add description (plot)
    if (movieInfo.omdb?.plot) {
      const desc = document.createElement("div");
      desc.className = "movie-description";
      desc.textContent = movieInfo.omdb.plot;
      info.appendChild(desc);
    }

    // Add ratings
    if (movieInfo.omdb) {
      const ratings = document.createElement("div");
      ratings.className = "movie-ratings";
      
      if (movieInfo.omdb.imdbRating !== "N/A") {
        const imdb = document.createElement("div");
        imdb.className = "rating";
        imdb.textContent = `IMDb: ${movieInfo.omdb.imdbRating}/10`;
        ratings.appendChild(imdb);
      }
      
      if (movieInfo.omdb.rtRating !== "N/A") {
        const rt = document.createElement("div");
        rt.className = "rating";
        rt.textContent = `Rotten Tomatoes: ${movieInfo.omdb.rtRating}`;
        ratings.appendChild(rt);
      }
      
      info.appendChild(ratings);
    }

    // Add format badges
    const uniqueFormats = new Set();
    Object.values(movieInfo.timeslots).forEach(slots => {
      slots.forEach(slot => {
        slot.attributes.forEach(attr => uniqueFormats.add(attr));
      });
    });

    if (uniqueFormats.size > 0) {
      const badges = document.createElement("div");
      badges.className = "format-badges";
      Array.from(uniqueFormats).forEach(format => {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = format;
        badges.appendChild(badge);
      });
      info.appendChild(badges);
    }

    header.appendChild(info);
    content.appendChild(header);
    movieCard.appendChild(content);

    // Add Show More button
    const showMoreBtn = document.createElement("button");
    showMoreBtn.className = "show-more-btn";
    showMoreBtn.textContent = "Show More";
    movieCard.appendChild(showMoreBtn);

    // Create timeslots section (initially hidden)
    const timeslots = document.createElement("div");
    timeslots.className = "timeslots";

    // Add timeslots for each cinema
    Object.entries(movieInfo.timeslots).forEach(([cinemaId, slots]) => {
      if (slots.length > 0) {
        const cinemaBlock = document.createElement("div");
        cinemaBlock.className = "cinema-block";

        const cinemaTitle = document.createElement("h3");
        cinemaTitle.textContent = CINEMA_NAMES[cinemaId] || `Cinema ${cinemaId}`;
        cinemaBlock.appendChild(cinemaTitle);

        const showtimes = document.createElement("div");
        showtimes.className = "showtimes";

        slots.sort((a, b) => a.time.localeCompare(b.time));
        slots.forEach(slot => {
          const showtime = document.createElement("span");
          showtime.className = "showtime";
          showtime.textContent = `${slot.time}`;
          showtimes.appendChild(showtime);
        });

        cinemaBlock.appendChild(showtimes);
        timeslots.appendChild(cinemaBlock);
      }
    });

    movieCard.appendChild(timeslots);

    // Add click handler for Show More button
    showMoreBtn.addEventListener("click", () => {
      timeslots.classList.toggle("visible");
      showMoreBtn.textContent = timeslots.classList.contains("visible") ? "Show Less" : "Show More";
    });

    moviesContainer.appendChild(movieCard);
  });
} 