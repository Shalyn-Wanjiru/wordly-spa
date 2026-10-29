const API_URL = "https://dictionaryapi.dev/";

const searchForm = document.querySelector("#search-form")
const wordInput = document.querySelector("#word-input")
const searchButton = document.querySelector("#search-button")
const results = document.querySelector("#results")
const statusMessage = document.querySelector("#status-message")
const favoritesList = document.querySelector("#favorites-list")
const favouriteCount = document.querySelector("#favorite-count")
const themeToggle = document.querySelector("#theme-toggle")


let currentEntries = [];
let currentWord = "";

let favorites = [];

try {
  favorites = JSON.parse(localStorage.getItem("wordly-favorites")) || [];
  if (!Array.isArray(favorites)) favorites = [];
} catch {
  favorites = [];
}

// Reusable helper for safely creating text elements.
function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

// Display a message to the user.
function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

// Save favorite words in the browser.
function saveFavorites() {
  try {
    localStorage.setItem("wordly-favorites", JSON.stringify(favorites));
  } catch {
    setStatus("Your browser could not save favorites.", true);
  }
}

// Find pronunciation text and audio, if available.
function getPronunciation(entry) {
  const phonetics = entry.phonetics || [];

  const phoneticText =
    entry.phonetic ||
    phonetics.find((item) => item.text)?.text ||
    "";

  const audioItem = phonetics.find(
    (item) => item.audio && item.audio.trim() !== ""
  );

  let audioUrl = audioItem?.audio || "";

  if (audioUrl.startsWith("//")) {
    audioUrl = "https:" + audioUrl;
  }

  return { phoneticText, audioUrl };
}

// Display all dictionary entries.
function displayResults(entries) {
  results.replaceChildren();

  entries.forEach((entry) => {
    const card = createElement("article", "entry-card");
    const heading = createElement("div", "word-heading");
    const wordInfo = createElement("div");
    const wordTitle = createElement("h2", "", entry.word);

    const { phoneticText, audioUrl } = getPronunciation(entry);

    const phonetic = createElement(
      "p",
      "phonetic",
      phoneticText || "Pronunciation unavailable"
    );

    wordInfo.append(wordTitle, phonetic);

    const actions = createElement("div", "word-actions");

    if (audioUrl) {
      const audioButton = createElement("button", "icon-action", "🔊");
      audioButton.type = "button";
      audioButton.setAttribute(
        "aria-label",
        `Play pronunciation of ${entry.word}`
      );

      audioButton.addEventListener("click", () => {
        const audio = new Audio(audioUrl);

        audio.play().catch(() => {
          setStatus("Could not play the pronunciation audio.", true);
        });
      });

      actions.append(audioButton);
    }

    const isSaved = favorites.includes(entry.word.toLowerCase());

    const favoriteButton = createElement(
      "button",
      `icon-action ${isSaved ? "saved" : ""}`,
      isSaved ? "♥" : "♡"
    );

    favoriteButton.type = "button";
    favoriteButton.setAttribute(
      "aria-label",
      `${isSaved ? "Remove" : "Save"} ${entry.word} ${isSaved ? "from" : "to"} favorites`
    );

    favoriteButton.addEventListener("click", () => {
      toggleFavorite(entry.word);
    });

    actions.append(favoriteButton);
    heading.append(wordInfo, actions);
    card.append(heading);

    // Display each part of speech and its definitions.
    (entry.meanings || []).forEach((meaning) => {
      const meaningSection = createElement("section", "meaning");

      meaningSection.append(
        createElement("h3", "part-of-speech", meaning.partOfSpeech)
      );

      const definitionList = createElement("ol", "definition-list");

      (meaning.definitions || []).forEach((definition) => {
        const item = createElement("li", "", definition.definition);

        if (definition.example) {
          item.append(
            createElement("span", "example", `"${definition.example}"`)
          );
        }

        definitionList.append(item);
      });

      meaningSection.append(definitionList);

      // Combine synonyms from the meaning and individual definitions.
      const synonyms = new Set(meaning.synonyms || []);

      (meaning.definitions || []).forEach((definition) => {
        (definition.synonyms || []).forEach((word) => synonyms.add(word));
      });

      if (synonyms.size > 0) {
        meaningSection.append(
          createElement("h4", "", "Synonyms")
        );

        const tagList = createElement("div", "tag-list");

        synonyms.forEach((word) => {
          tagList.append(createElement("span", "tag", word));
        });

        meaningSection.append(tagList);
      }

      meaningSection.append(
        createElement("h4", "", "Antonyms")
      );

      const antonyms = new Set(meaning.antonyms || []);

      (meaning.definitions || []).forEach((definition) => {
        (definition.antonyms || []).forEach((word) => antonyms.add(word));
      });

      const antonymList = createElement("div", "tag-list");

      if (antonyms.size > 0) {
        antonyms.forEach((word) => {
          antonymList.append(createElement("span", "tag", word));
        });
      } else {
        antonymList.append(
          createElement("span", "example", "No antonyms provided.")
        );
      }

      meaningSection.append(antonymList);
      card.append(meaningSection);
    });

    // Display source links when the API provides them.
    if (entry.sourceUrls?.length) {
      const source = createElement("p", "example", "Source: ");
      const link = createElement("a", "", "View dictionary source");

      link.href = entry.sourceUrls[0];
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      source.append(link);
      card.append(source);
    }

    results.append(card);
  });
}

// Fetch a word from the external dictionary API.
async function searchWord(word) {
  const normalizedWord = word.trim().toLowerCase();

  if (!normalizedWord) {
    setStatus("Please enter a word to search.", true);
    return;
  }

  currentWord = normalizedWord;
  currentEntries = [];

  searchButton.disabled = true;
  searchButton.textContent = "Searching...";
  setStatus(`Looking up "${normalizedWord}"...`);

  results.replaceChildren(
    createElement("p", "empty-state", "Loading dictionary results...")
  );

  try {
    const response = await fetch(
  `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (response.status === 404) {
      throw new Error("WORD_NOT_FOUND");
    }

    if (!response.ok) {
      throw new Error("API_ERROR");
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("WORD_NOT_FOUND");
    }

    currentEntries = data;
    displayResults(currentEntries);
    setStatus(`Found ${data.length} dictionary entr${data.length === 1 ? "y" : "ies"}.`);
  } catch (error) {
    results.replaceChildren();

    const errorBox = createElement("div", "empty-state");
    errorBox.append(
      createElement("h2", "", error.message === "WORD_NOT_FOUND"
        ? "Word not found"
        : "Something went wrong"),
      createElement("p", "", error.message === "WORD_NOT_FOUND"
        ? `We couldn't find "${normalizedWord}". Check the spelling and try again.`
        : "We couldn't retrieve the definition. Check your internet connection and try again.")
    );

    results.append(errorBox);

    if (error.message === "WORD_NOT_FOUND") {
      setStatus("No definition found for that word.", true);
    } else {
      setStatus("Dictionary request failed. Please try again.", true);
    }
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Search →";
  }
}

// Handle form submission without reloading the page.
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchWord(wordInput.value);
});

// Add or remove a favorite word.
function toggleFavorite(word) {
  const normalizedWord = word.toLowerCase();

  if (favorites.includes(normalizedWord)) {
    favorites = favorites.filter((item) => item !== normalizedWord);
    setStatus(`Removed "${word}" from favorites.`);
  } else {
    favorites.push(normalizedWord);
    setStatus(`Saved "${word}" to favorites.`);
  }

  saveFavorites();
  displayFavorites();

  // Update the heart icons without another API request.
  if (currentEntries.length > 0) {
    displayResults(currentEntries);
  }
}

// Render the saved words list.
function displayFavorites() {
  favoritesList.replaceChildren();
  favoriteCount.textContent = favorites.length;

  if (favorites.length === 0) {
    favoritesList.append(
      createElement("li", "example", "No saved words yet.")
    );
    return;
  }

  favorites.forEach((word) => {
    const item = createElement("li", "favorite-item");

    const wordButton = createElement("button", "favorite-word", word);
    wordButton.type = "button";
    wordButton.addEventListener("click", () => {
      wordInput.value = word;
      searchWord(word);
    });

    const removeButton = createElement("button", "remove-favorite", "×");
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${word} from favorites`);

    removeButton.addEventListener("click", () => {
      favorites = favorites.filter((item) => item !== word);
      saveFavorites();
      displayFavorites();

      if (currentEntries.length > 0) {
        displayResults(currentEntries);
      }

      setStatus(`Removed "${word}" from favorites.`);
    });

    item.append(wordButton, removeButton);
    favoritesList.append(item);
  });
}

// Switch between light and dark themes.
themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");

  themeToggle.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";

  try {
    localStorage.setItem("wordly-dark-mode", String(isDark));
  } catch {
    // Theme switching still works if storage is unavailable.
  }
});

// Restore the theme and favorites on page load.
try {
  const savedTheme = localStorage.getItem("wordly-dark-mode") === "true";

  document.body.classList.toggle("dark", savedTheme);
  themeToggle.textContent = savedTheme ? "☀️ Light mode" : "🌙 Dark mode";
} catch (error) {
  console.error("Wordly search error:", error);
  results.replaceChildren();
}
