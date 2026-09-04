# Liatai (Real-time!)

[![Version](https://img.shields.io/badge/version-1.3.1-blue.svg)](https://github.com/keigoly/Liatai/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[日本語](README.md) | English

---

## 🆕 v1.3.1 Updates

### Improvements
* Minor fixes

---

## 🆕 v1.3.0 Updates

### New Features
* **🔐 Google Account Integration**: Sign in with Google to sync settings, saved words, block settings, and search history to the cloud.
* **☁️ Cross-Device Sync**: Real-time sync via Firestore. Share the same settings across multiple Chrome environments.
* **👋 Welcome Screen**: Animated welcome screen on first launch. Choose to register a Google account or skip.

### Improvements
* **#️⃣ Improved Hashtag Parsing**: Uses Yahoo JSON hashtag data for precise hashtag identification instead of regex guessing.
* **📱 SNS Share Moved to Common Footer**: Now always visible across Trends, Saved, and Settings tabs.
* **🛡️ Security Enhancements**: User data protection via Firestore Security Rules, secure authentication via Chrome Identity API.

---

## 🆕 v1.2.6 Updates

### Improvements
* **📁 Show All Folder Words**: Removed the 10-item limit. 11+ items are now scrollable with a bottom gradient indicator.
* **🔄 Up/Down Button Reordering**: Replaced drag & drop with reliable up/down buttons for word reordering.
* **➕ New Words Added to Bottom**: Newly added words now appear at the end of the list.
* **📝 Menu Position Fix**: Context menu opens upward for items near the bottom of the list.

---

## 🆕 v1.2.5 Updates

### Improvements
* **🎯 Faster Data Fetching**: Now fetches tweets directly from `__NEXT_DATA__` JSON for faster and more accurate results compared to DOM parsing.
* **📊 Post Count Graph**: Displays post count trends in search results. Supports 6h/24h/7d/30d period switching.
* **📄 Load More**: You can now scroll back through older posts.

---

## 🆕 v1.2.4 Updates

### Fixes
* **#️⃣ Hashtag Display Fix**: Fixed an issue where multiple hashtags were concatenated. `#tag1#tag2` is now correctly split into individual links.
* **🔗 Hashtag + URL Separation**: Fixed an issue where a URL immediately following a hashtag (`#taghttps://...`) was merged into the hashtag.

### Improvements
* **📁 Drag & Drop Word Reordering**: Replaced up/down buttons with grip handle drag & drop in folder word list, with a swap animation.
* **📝 Word 3-dot Menu**: Added a context menu (Edit word, Move to another folder, Delete) to folder words. Moving uses a dedicated confirmation screen for safe operation.
* **🌍 Chrome Web Store Localization**: Extension name and description are displayed in Japanese or English based on your browser's language settings.

---

## 🆕 v1.2.2 Updates

### Improvements
* **🎨 Search Animation Improvements**: Improved the search results display animation for a smoother experience.
* **🔄 Natural Best Post Flow**: Best posts now flow naturally into the list during background updates.
* **🖼️ Media Display Fix**: Fixed an issue where some media were not displayed correctly.

---

## 🆕 v1.2.1 Updates

### New Features
* **⭐ Best Post Refresh Interval Setting**: You can now choose the best post refresh interval from 1 min / 5 min / 10 min / 30 min.
* **🔄 Natural Best Post Display**: When the best post is updated, it is now naturally added to the list instead of reloading the entire list.
* **📊 Graph Auto-Refresh**: The post count graph now supports auto-refresh.

---

## 🆕 v1.2.0 Updates

### New Features
* **📊 Post Count Graph**: Visualize the trend of post counts for your search keyword. Supports 6-hour, 24-hour, 7-day, and 30-day period switching. Also displays sentiment analysis (positive/negative ratio).
* **📄 Load More**: You can now scroll back through older posts. Click the "Load More" button at the bottom to fetch additional posts.
* **🔗 SNS Share**: Share buttons added to Trends, Registered Words, and Settings screens. Share via X, LINE, Facebook, Threads, Reddit, and Chrome Web Store.
* **🌍 Chrome Web Store Localization**: Extension name and description are displayed in Japanese or English based on your browser's language settings.

### Improvements
* **🎯 Accurate Data from Yahoo**: Improved to accurately fetch Best Post and Timeline from `__NEXT_DATA__` JSON.
* **🪟 Improved New Window**: Now carries over your current search state when opening a new window. Window size automatically adjusts to your screen height.
* **📁 Folder State Persistence**: Folder open/close state is now preserved across screen transitions.
* **⭐ Best Post Refresh**: Fixed to reliably re-display the Best Post at the top every 5 minutes.
* **⚙️ Settings UI Improvements**: Moved latest update info position, added NG filter item count display, added default graph period setting.

---

## 🆕 v1.1.1 Updates

### Fixes
* **🔧 Chrome Web Store Policy Compliance**: Removed unused `storage` permission to fully comply with store policies.

---

## ◇ Overview

Check "What's happening now?" instantly without stopping your work.
The ultimate tool for staying updated and monitoring trends, bringing real-time search to your Chrome side panel.

"Liatai" allows you to view real-time search results (X/Twitter trends and posts) in the side panel without switching browser tabs. While watching videos, reading articles, or working... you can follow the world's reactions in real-time "on the side" of any task.

---

## 【Core Features】

### 1. Unobtrusive "Side Panel" Display
No need to open a new tab to search. It appears smoothly on the side of your browser, allowing you to "watch" trending topics and keyword excitement without interrupting your main work.

### 2. Comprehensive "Auto-Refresh" Customization
Equipped with auto-refresh features so you don't miss the latest info. Refresh intervals can be finely tuned to suit your needs.

* **Trend Refresh**: 1 min / 3 min / 5 min / 10 min
* **Search Results Refresh**: 1 sec / 3 sec / 5 sec / 10 sec
  * (*Ultra-fast second-level updates ensure you don't miss the flow of live commentary*)

### 3. Powerful "NG Filter" Function
Block unwanted information before it enters your view. Create a comfortable timeline.

* **NG Words**: Hide posts containing specific words.
* **NG Users**: Hide posts from specific user IDs (@...).
* **Regex Support**: Advanced filtering using regular expressions is supported for power users.

### 4. 📊 Post Count Graph
View the post count trend for your search keyword. Switch between 6-hour, 24-hour, 7-day, and 30-day periods. Sentiment analysis (positive/negative) is also displayed.

### 5. 🌐 Multi-language Support
Switch between Japanese and English from the settings screen. Chrome Web Store also auto-displays based on your browser language.

### 6. 🪟 Popup Window
Switch from the side panel to a popup window. Your current search state is carried over to the independent window.

---

## ◇ Customize Your Design

We've enriched the design settings so you don't get tired even after watching for a long time.

* **Background Mode**: Choose from 3 types: "Default", "Dark Blue", and "True Black (for OLED)".
* **Theme Color**: Change the accent color from 6 options to match your mood or favorite color.
* **Font Size**: Adjustable in 5 stages from 13px to 18px for best readability.

---

## ◇ Privacy First Design

This extension saves setting information only within your browser and does not send personal data to external servers. You can use it with peace of mind.

For details, please see our [Privacy Policy](PRIVACY_EN.md).

---

## ◇ From the Developer

I developed this because "it's troublesome to open a search screen every time" and "I want to watch TV commentary comfortably on my PC".
We always welcome bug reports and feature requests via the link in the settings screen.

---

## ◇ Links

* [Chrome Web Store](https://chromewebstore.google.com/detail/indeiidgljnaokghbdogclapjjngmnkb)
* [Developer's Extensions](https://keigoly.jp/apps)
* [Developer's Official Site](https://keigoly.jp/)
* [GitHub Repository](https://github.com/keigoly/Liatai)
* [Bug Report Form](https://docs.google.com/forms/d/e/1FAIpQLSeUlF5s7vgcG0RrISNrAwLKhMQTvJpndH8e31Z_WHF081McEA/viewform)
