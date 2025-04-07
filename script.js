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
  // Key = movie name, Value = { name, timeslots: { [cinemaId]: [ {time, attributes}, ... ] }, omdb: {...} }
  const allMovies = {};

  // A set to track unique movie names (so we only call OMDb once per movie)
  const uniqueMovieNames = new Set();

  // 1) Fetch from Cinema City for each cinema ID
  for (const cinemaId of cinemaIds) {
    // Use the reverse proxy for Cinema City API
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

      // Map filmId -> film info
      const filmMap = {};
      films.forEach(f => {
        filmMap[f.id] = f;
      });

      // Assign events to the correct film
      events.forEach(evt => {
        const filmId = evt.filmId;
        const film = filmMap[filmId];
        if (!film) return; // Safety check

        const filmName = film.name;

        // Initialize structure if not present
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

        // Extract time from ISO datetime string
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
      // Use the reverse proxy for OMDb API
      const omdbUrl = `/proxy/omdb?title=${encodeURIComponent(movieName)}`;
      const omdbResponse = await fetch(omdbUrl);
      const omdbData = await omdbResponse.json();

      if (omdbData.Response === "True") {
        // Extract IMDb + Rotten Tomatoes
        let imdbRating = omdbData.imdbRating || "N/A";
        let rtRating = "N/A";
        if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
          const rtObj = omdbData.Ratings.find(
            r => r.Source === "Rotten Tomatoes"
          );
          if (rtObj) {
            rtRating = rtObj.Value;
          }
        }

        allMovies[movieName].omdb = {
          imdbRating,
          rtRating,
          year: omdbData.Year,
          plot: omdbData.Plot,
          poster: omdbData.Poster,
        };
      } else {
        // Possibly store the error
        allMovies[movieName].omdb = { error: omdbData.Error };
      }
    } catch (err) {
      console.error("Error fetching OMDb data for:", movieName, err);
    }
  }

  // 3) Render everything in the DOM
  moviesContainer.innerHTML = "";
  const sortedMovieNames = Object.keys(allMovies).sort(); // sort alphabetically

  sortedMovieNames.forEach(movieName => {
    const movieInfo = allMovies[movieName];
    const movieCard = document.createElement("div");
    movieCard.className = "movie-card";

    // Title
    const titleEl = document.createElement("h2");
    titleEl.textContent = movieName;
    movieCard.appendChild(titleEl);

    // Basic film length if available
    if (movieInfo.length) {
      const lengthEl = document.createElement("p");
      lengthEl.textContent = `Length: ${movieInfo.length} mins`;
      movieCard.appendChild(lengthEl);
    }

    // OMDb info
    if (movieInfo.omdb) {
      const { imdbRating, rtRating, year, plot, poster, error } =
        movieInfo.omdb;

      if (!error) {
        const ratingsEl = document.createElement("p");
        ratingsEl.textContent = `IMDb: ${imdbRating}, RT: ${rtRating}`;
        movieCard.appendChild(ratingsEl);

        // Optionally show year or plot
        const yearEl = document.createElement("p");
        yearEl.textContent = `Year: ${year}`;
        movieCard.appendChild(yearEl);

        const plotEl = document.createElement("p");
        plotEl.textContent = `Plot: ${plot}`;
        movieCard.appendChild(plotEl);

        if (poster && poster !== "N/A") {
          const posterImg = document.createElement("img");
          posterImg.src = poster;
          posterImg.alt = `${movieName} Poster`;
          posterImg.style.width = "100px";
          movieCard.appendChild(posterImg);
        }
      } else {
        const errorEl = document.createElement("p");
        errorEl.textContent = `OMDb Error: ${error}`;
        movieCard.appendChild(errorEl);
      }
    }

    // Timeslots
    const timeslotsWrapper = document.createElement("div");
    timeslotsWrapper.className = "timeslots";

    for (const cinemaId of cinemaIds) {
      const cinemaSlots = movieInfo.timeslots[cinemaId];
      if (cinemaSlots && cinemaSlots.length > 0) {
        const cinemaDiv = document.createElement("div");
        cinemaDiv.className = "cinema-block";

        const cinemaTitle = document.createElement("h3");
        cinemaTitle.textContent = `Cinema ${cinemaId}`;
        cinemaDiv.appendChild(cinemaTitle);

        cinemaSlots.forEach(slot => {
          const slotEl = document.createElement("p");
          slotEl.textContent = `${slot.time} (${slot.attributes.join(", ")})`;
          cinemaDiv.appendChild(slotEl);
        });

        timeslotsWrapper.appendChild(cinemaDiv);
      }
    }

    movieCard.appendChild(timeslotsWrapper);
    moviesContainer.appendChild(movieCard);
  });
} 