use reqwest;
use scraper::{Html, Selector};
use scraper::element_ref::ElementRef;
use scraper::Element;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::sync::{Arc, Mutex};
use tauri::{Manager, Emitter, Listener};
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScrapedHymn {
    pub number: i32,
    pub title: String,
    pub verses: Vec<String>,
    pub has_refrain: bool,
    pub refrain_text: Option<String>,
    pub author: Option<String>,
    pub key_signature: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScrapingProgress {
    pub current: i32,
    pub total: i32,
    pub message: String,
}

/// Helper function to get default Afrikaans hymn titles for common numbers
fn get_afrikaans_hymn_title(number: i32) -> Option<String> {
    match number {
        1 => Some("Buig Voor Jehova Met Ontsag".to_string()),
        2 => Some("Laat Elk Die Heer Se Goedheid Lowe".to_string()),
        3 => Some("O Nader Die Heer".to_string()),
        4 => Some("Prys, My Siel, Die Hemelheer!".to_string()),
        5 => Some("U Alomteenwoordigheid".to_string()),
        10 => Some("Prys God Drie-Enige Allerhoogste".to_string()),
        12 => Some("Jubelend Loof Ons".to_string()),
        15 => Some("Halleluja! Loof Gods Almag".to_string()),
        20 => Some("Net U Is God".to_string()),
        25 => Some("Eer Die Naam Van God".to_string()),
        30 => Some("Heilige God, Ons Prys U".to_string()),
        35 => Some("Die Heilige Sabbatdag".to_string()),
        50 => Some("Jesus, Die Lig Van Die Wereld".to_string()),
        73 => Some("Heilige Nag".to_string()),
        86 => Some("Hoe Groot Is U".to_string()),
        88 => Some("Ek Moet Jesus By My He".to_string()),
        100 => Some("Groot Is U Trou, O Heer".to_string()),
        108 => Some("Hoe Lieflik, Heer Jesus".to_string()),
        125 => Some("O Liefde Van God".to_string()),
        150 => Some("Jesus, Die Kindersvriend".to_string()),
        181 => Some("Jesus Is Ons Herder".to_string()),
        199 => Some("Ek Het Die Stem Van Jesus".to_string()),
        214 => Some("Wil Jy Vry Wees?".to_string()),
        229 => Some("Alle Mag Het Jesus Christus".to_string()),
        300 => Some("Rots Van Eeue".to_string()),
        334 => Some("Kom, Almal, Kom!".to_string()),
        348 => Some("Die Stem Van Die Here".to_string()),
        362 => Some("Sy Woord Is 'n Lamp".to_string()),
        400 => Some("Red Die Verlore".to_string()),
        422 => Some("Dra U kruis Met Blydskap".to_string()),
        458 => Some("Soet Vrede, Gawe Van Gods Liefde".to_string()),
        461 => Some("Naderbij, U, O Heer".to_string()),
        470 => Some("Daar is 'n Dierbaar Boek".to_string()),
        481 => Some("By Die Troon Met Lof Omgewe".to_string()),
        _ => None,
    }
}

/// Scrape Seventh-day Adventist hymns from hymnary.org or adventlofliedere.co.za
pub async fn scrape_sda_hymnal(
    app_handle: tauri::AppHandle,
    language: &str,
) -> Result<Vec<ScrapedHymn>, Box<dyn Error>> {
    let window = app_handle.get_webview_window("main").unwrap();

    let (base_url, total_hymns, afrikaans_source) = match language {
        "ENG" => ("https://hymnary.org/hymn/SDAH1985/", 695, false),
        "AFR" => {
            // For Afrikaans, we'll continue using hymnary.org but with fallback titles
            ("https://hymnary.org/hymn/SDAH1985", 481, true)
        },
        _ => return Err("Unsupported language".into()),
    };

    let mut hymns = Vec::new();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()?;

    // Remove the demo_limit and use all available hymns
    let actual_total = total_hymns;

    // Store progress in a thread-safe way
    let progress = Arc::new(Mutex::new(ScrapingProgress {
        current: 0,
        total: actual_total,
        message: "Starting scraping...".to_string(),
    }));

    // Add initial check to determine total number of hymns dynamically if possible
    let _ = window.emit("scraping-progress", ScrapingProgress {
        current: 0,
        total: actual_total,
        message: format!("Starting scraping {} hymns...", actual_total),
    });

    // Create atomic stop flag
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_clone = Arc::clone(&stop_flag);

    // Create a separate thread for emitting progress events to avoid tendril threading issues
    let progress_clone = Arc::clone(&progress);
    let window_clone = window.clone();
    let _progress_sender = tokio::task::spawn_blocking(move || {
        let mut last_message = String::new();
        let mut last_current = 0;
        
        while !stop_flag_clone.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(100));
            
            let progress_guard = progress_clone.lock().unwrap();
            if progress_guard.message != last_message || progress_guard.current != last_current {
                let _ = window_clone.emit("scraping-progress", progress_guard.clone());
                last_message = progress_guard.message.clone();
                last_current = progress_guard.current;
            }
        }
    });

    // Scrape each hymn
    for i in 1..=actual_total {
        // Check if scraping should be stopped
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }

        let hymn_number = i;
        let hymn_url = if afrikaans_source {
            // For Afrikaans hymns, we need to properly format the search URL
            format!("{}/{}", base_url, hymn_number)
        } else {
            // For English hymns, use the correct format for the hymnal page
            format!("{}/{}", base_url, hymn_number)
        };
        
        {
            let mut progress_guard = progress.lock().unwrap();
            progress_guard.current = i;
            progress_guard.message = format!("Scraping hymn {} of {}: {}", i, actual_total, hymn_url);
        }

        // Fetch the hymn page
        let response = match client.get(&hymn_url).send().await {
            Ok(resp) => resp,
            Err(e) => {
                // Log error and continue to next hymn
                let mut guard = progress.lock().unwrap();
                guard.message = format!("Error fetching hymn {}: {}", hymn_number, e);
                continue;
            }
        };
        
        // Check if the response is successful
        if !response.status().is_success() {
            let mut guard = progress.lock().unwrap();
            guard.message = format!("Failed to fetch hymn {}: HTTP {}", hymn_number, response.status());
            continue;
        }
        
        // Get the HTML content
        let html_content = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                let mut guard = progress.lock().unwrap();
                guard.message = format!("Error reading hymn {}: {}", hymn_number, e);
                continue;
            }
        };
        
        // Parse the HTML
        let document = Html::parse_document(&html_content);
        
        // Extract hymn based on the source
        if afrikaans_source {
            // For Afrikaans hymns, we'll use the English hymn format but apply Afrikaans titles
            // where possible, and indicate it's Afrikaans
            
            // Get default Afrikaans title if available, otherwise use English title
            let title_selector = Selector::parse("h1.hymntitle, h2.hymntitle, .hymn-title, .hymn h1, .hymn h2, h1, h2").unwrap();
            
            let mut title = match document.select(&title_selector).next() {
                Some(element) => element.text().collect::<Vec<_>>().join(" ").trim().to_string(),
                None => format!("Lied {}", hymn_number), // Default if no title found
            };
            
            // If we have a default Afrikaans title for this number, use it
            if let Some(afrikaans_title) = get_afrikaans_hymn_title(hymn_number) {
                title = afrikaans_title;
            } else if !title.is_empty() && title != format!("Hymn {}", hymn_number) && title != format!("Lied {}", hymn_number) {
                // If we got an English title from the page and it's not the default,
                // add a note that it's a translation
                title = format!("{} (Vertaling)", title);
            }
            
            // Extract verses - these are usually in div or p tags with specific classes
            let verse_selector = Selector::parse("div.hymn-text, .hymn p, .hymn div, .verse, .stanza").unwrap();
            
            let mut verses = Vec::new();
            let mut has_refrain = false;
            let mut refrain_text = None;
            
            for verse_element in document.select(&verse_selector) {
                let verse_text = verse_element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                
                // Skip empty verses
                if verse_text.is_empty() {
                    continue;
                }
                
                // Check if this is a refrain
                if verse_text.to_lowercase().contains("refrain") || 
                   verse_text.to_lowercase().contains("chorus") || 
                   verse_text.to_lowercase().contains("koor") || 
                   verse_text.to_lowercase().contains("refrein") {
                    has_refrain = true;
                    
                    // For Afrikaans, replace "Refrain" with "Koor" in the text
                    let refrain_text_processed = verse_text.replace("Refrain", "Koor").replace("refrain", "koor");
                    refrain_text = Some(refrain_text_processed);
                } else {
                    // For Afrikaans hymns, we include a note that these are original English verses
                    // only on the first verse to avoid repetition
                    let verse_with_note = if verses.is_empty() {
                        format!("{}\n(Engelse oorspronklike verse - vervang met Afrikaanse verse indien beskikbaar)", verse_text)
                    } else {
                        verse_text
                    };
                    verses.push(verse_with_note);
                }
            }
            
            // If no verses found but we have a title, create better placeholder verses
            if verses.is_empty() && !title.is_empty() {
                // Create placeholders for 3 verses to match typical hymn structure
                for i in 1..=3 {
                    verses.push(format!("Vers {} - Voeg asseblief verse by vir hierdie lied.", i));
                }
            }
            
            // If we have enough information, create a hymn object
            if !verses.is_empty() || !title.is_empty() {
                let hymn = ScrapedHymn {
                    number: hymn_number,
                    title,
                    verses,
                    has_refrain,
                    refrain_text,
                    author: None,
                    key_signature: None,
                };
                
                // Add hymn to the list
                let hymn_title = hymn.title.clone(); // Store the title before moving hymn
                hymns.push(hymn);
                
                // Update progress with found hymn info
                let mut guard = progress.lock().unwrap();
                guard.current = i;
                guard.message = format!("Found hymn {}: {}", hymn_number, hymn_title);
            }
        } else {
            // New scraping logic for hymnary.org English hymns
            let hymn_number_parsed = hymn_number;
            
            // Extract the hymn title - it's usually in an h2 tag with class text-title
            let title_selector = Selector::parse("h2.text-title, h2, h1.page-title").unwrap();
            
            let title = match document.select(&title_selector).next() {
                Some(element) => {
                    let full_title = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                    
                    // Clean up the title - if it starts with a number like "1. Praise to the Lord"
                    if let Some(dot_pos) = full_title.find('.') {
                        // Check if the part before the dot is a number
                        if full_title[0..dot_pos].trim().parse::<i32>().is_ok() {
                            // Return everything after the dot
                            full_title[dot_pos + 1..].trim().to_string()
                        } else {
                            // Try another approach - see if the title contains the hymn number
                            let prefix = format!("{}.", hymn_number);
                            if full_title.starts_with(&prefix) {
                                full_title[prefix.len()..].trim().to_string()
                            } else {
                                // Check if the title starts with the page number followed by '.'
                                let num_str = hymn_number.to_string();
                                if full_title.starts_with(&num_str) && full_title.len() > num_str.len() {
                                    let remaining = &full_title[num_str.len()..];
                                    if remaining.starts_with('.') || remaining.starts_with(' ') {
                                        remaining.trim_start_matches(&['.', ' '][..]).trim().to_string()
                                    } else {
                                        full_title
                                    }
                                } else {
                                    // Last attempt - look for h2.text-title
                                    let specific_title_selector = Selector::parse("h2.text-title").unwrap_or(Selector::parse("h2").unwrap());
                                    if let Some(specific_title) = document.select(&specific_title_selector).next() {
                                        let specific_text = specific_title.text().collect::<Vec<_>>().join(" ").trim().to_string();
                                        if !specific_text.is_empty() && specific_text != full_title {
                                            specific_text
                                        } else {
                                            full_title
                                        }
                                    } else {
                                        full_title
                                    }
                                }
                            }
                        }
                    } else {
                        full_title
                    }
                },
                None => {
                    // Try to extract from the document title
                    let title_selector = Selector::parse("title").unwrap();
                    if let Some(title_element) = document.select(&title_selector).next() {
                        let full_title = title_element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                        
                        // Look for a pattern like "Hymn: Title - Something"
                        if let Some(colon_pos) = full_title.find(':') {
                            let after_colon = full_title[colon_pos + 1..].trim();
                            
                            // If there's a dash, take everything before it
                            if let Some(dash_pos) = after_colon.find('-') {
                                after_colon[0..dash_pos].trim().to_string()
                            } else {
                                after_colon.to_string()
                            }
                        } else {
                            format!("Hymn {}", hymn_number_parsed)
                        }
                    } else {
                        format!("Hymn {}", hymn_number_parsed)
                    }
                }
            };
            
            // Find the author if available
            let author_selector = Selector::parse("a[href*='person']").unwrap();
            let mut author = None;
            
            if let Some(element) = document.select(&author_selector).next() {
                let author_text = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                if !author_text.is_empty() {
                    author = Some(author_text);
                }
            }
            
            // Extract verses - they are usually in a div with class poetry or in the page content
            let poetry_selector = Selector::parse("div.poetry, div.flex-right").unwrap();
            
            let mut verses = Vec::new();
            let mut has_refrain = false;
            let mut refrain_text = None;
            
            if let Some(poetry) = document.select(&poetry_selector).next() {
                // The verses are usually in divs with class stanza or paragraphs
                let stanza_selector = Selector::parse("div.stanza, p").unwrap();
                
                for verse_element in poetry.select(&stanza_selector) {
                    let verse_text = verse_element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                    
                    // Skip empty verses and navigation elements
                    if verse_text.is_empty() || 
                       verse_text.contains("Log in") || 
                       verse_text.contains("Search") {
                        continue;
                    }
                    
                    // Check if this is a refrain
                    if verse_text.to_lowercase().contains("refrain") || verse_text.to_lowercase().contains("chorus") {
                        has_refrain = true;
                        refrain_text = Some(verse_text);
                    } else {
                        verses.push(verse_text);
                    }
                }
            }
            
            // If we didn't find verses in the poetry div, try looking directly at the page content
            if verses.is_empty() {
                // Try to find the full text section
                let full_text_selector = Selector::parse("h3:contains('Full Text'), h3:contains('Text')").unwrap_or(Selector::parse("h3").unwrap());
                
                if let Some(full_text_heading) = document.select(&full_text_selector).next() {
                    // Get all paragraph or div elements that follow this heading
                    if let Some(parent) = full_text_heading.parent_element() {
                        let siblings_selector = Selector::parse("p, div").unwrap();
                        
                        for sibling in parent.select(&siblings_selector) {
                            let text = sibling.text().collect::<Vec<_>>().join(" ").trim().to_string();
                            
                            // Skip empty text and navigation elements
                            if text.is_empty() || 
                               text.contains("Log in") || 
                               text.contains("Search") {
                                continue;
                            }
                            
                            // Check if this is a refrain
                            if text.to_lowercase().contains("refrain") || text.to_lowercase().contains("chorus") {
                                has_refrain = true;
                                refrain_text = Some(text);
                            } else if text.contains("1 ") || text.contains("1. ") {
                                // This is likely a verse
                                // Split the text by verse numbers (1, 2, 3, etc.)
                                let verse_texts = split_into_verses(&text);
                                for verse in verse_texts {
                                    // Clean up the verse text by removing any verse numbers from the beginning
                                    let cleaned_verse = clean_verse_text(&verse);
                                    verses.push(cleaned_verse);
                                }
                            } else if !text.contains("About") && !text.contains("Copyright") {
                                // If it doesn't contain verse numbers but also isn't footer text,
                                // it might be a standalone verse
                                verses.push(text);
                            }
                        }
                    }
                }
            }
            
            // If we still don't have verses, try a more generic approach - just get all paragraphs
            if verses.is_empty() {
                let p_selector = Selector::parse("p").unwrap();
                
                for p in document.select(&p_selector) {
                    let text = p.text().collect::<Vec<_>>().join(" ").trim().to_string();
                    
                    // Skip empty text and navigation elements
                    if text.is_empty() || 
                       text.contains("Log in") || 
                       text.contains("Search") ||
                       text.contains("About") || 
                       text.contains("Copyright") {
                        continue;
                    }
                    
                    // Check for verse numbers at the beginning (1, 2, 3, etc.)
                    if text.starts_with("1 ") || text.starts_with("1. ") || 
                       text.contains("\n1 ") || text.contains("\n1. ") {
                        // This is likely a text with multiple verses
                        let verse_texts = split_into_verses(&text);
                        for verse in verse_texts {
                            // Clean up the verse text by removing any verse numbers from the beginning
                            let cleaned_verse = clean_verse_text(&verse);
                            verses.push(cleaned_verse);
                        }
                    } else if text.to_lowercase().contains("refrain") || text.to_lowercase().contains("chorus") {
                        has_refrain = true;
                        refrain_text = Some(text);
                    } else {
                        // If it doesn't seem to be a multi-verse text or a refrain, add it as a single verse
                        verses.push(text);
                    }
                }
            }
            
            // Look for key signature in the tune information
            let mut key_signature = None;
            let tune_selector = Selector::parse("a[href*='tune']").unwrap();
            
            if let Some(tune_element) = document.select(&tune_selector).next() {
                let tune_name = tune_element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                
                // Try to extract key information if it's in the tune name (e.g., "CORONATION (G major)")
                if tune_name.contains("major") || tune_name.contains("minor") {
                    let start_idx = tune_name.find('(').unwrap_or(0);
                    let end_idx = tune_name.find(')').unwrap_or(tune_name.len());
                    
                    if start_idx < end_idx && start_idx > 0 {
                        let key = tune_name[start_idx + 1..end_idx].trim().to_string();
                        if !key.is_empty() {
                            key_signature = Some(key);
                        }
                    }
                }
            }
            
            // Create a placeholder if we still have no verses
            if verses.is_empty() {
                verses.push(format!("Verse 1 - Verses not available for hymn #{} ({})", hymn_number_parsed, title));
            }
            
            // Add the hymn to our list if we have a title
            if !title.is_empty() {
                let hymn = ScrapedHymn {
                    number: hymn_number_parsed,
                    title,
                    verses,
                    has_refrain,
                    refrain_text,
                    author,
                    key_signature,
                };

                // Add hymn to the list
                let hymn_title = hymn.title.clone(); // Store the title before moving hymn
                hymns.push(hymn);
                
                // Update progress with found hymn info
                let mut guard = progress.lock().unwrap();
                guard.current = i;
                guard.message = format!("Found hymn {}: {}", hymn_number_parsed, hymn_title);
            }
        }

        // Respect the server by not sending too many requests too quickly
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }

    // Set up a listener for the stop-scraping event (separate from the main loop)
    let stop_flag_for_listener = Arc::clone(&stop_flag);
    let _stop_listener = window.listen("stop-scraping", move |_| {
        stop_flag_for_listener.store(true, Ordering::SeqCst);
    });

    // Final progress update
    {
        let mut guard = progress.lock().unwrap();
        guard.current = actual_total;
        
        if hymns.is_empty() {
            guard.message = format!("Scraping complete but no hymns were found. Please check the source or try a different language.");
        } else {
            guard.message = format!("Scraping complete. Found {} hymns", hymns.len());
        }
        
        // Make sure to emit this final progress update directly
        let _ = window.emit("scraping-progress", guard.clone());
    }

    // Set the stop flag to terminate the progress monitoring thread
    stop_flag.store(true, Ordering::SeqCst);
    
    // Give the progress thread a moment to complete
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(hymns)
}

// Helper function to clean verse text by removing verse numbers from the beginning
fn clean_verse_text(verse: &str) -> String {
    let trimmed = verse.trim();
    
    // If it starts with a number followed by a period or space, remove it
    if let Some(first_char) = trimmed.chars().next() {
        if first_char.is_numeric() {
            if let Some(pos) = trimmed.find(|c| c == '.' || c == ' ') {
                // Check if what we're removing is actually a number
                if trimmed[0..pos].parse::<i32>().is_ok() {
                    return trimmed[pos+1..].trim().to_string();
                }
            }
        }
    }
    
    trimmed.to_string()
}

// Helper function to split text with multiple verses into individual verses
fn split_into_verses(text: &str) -> Vec<String> {
    let mut verses = Vec::new();
    let mut current_verse = String::new();
    let mut verse_number = 1;
    
    // Split the text by lines first
    let lines: Vec<&str> = text.split('\n').collect();
    
    for line in lines {
        let trimmed = line.trim();
        
        // Skip empty lines
        if trimmed.is_empty() {
            continue;
        }
        
        // Check if this line starts with a verse number
        if (trimmed.starts_with(&format!("{} ", verse_number)) || 
            trimmed.starts_with(&format!("{}. ", verse_number)) ||
            trimmed == &verse_number.to_string()) && verse_number > 1 {
            
            // Save the previous verse if we have one
            if !current_verse.is_empty() {
                verses.push(current_verse.trim().to_string());
                current_verse = String::new();
            }
            
            // Add the line without the verse number if it's more than just the number
            if trimmed.len() > format!("{}. ", verse_number).len() {
                // Find the position after the verse number and period
                let pos = trimmed.find('.').map(|p| p + 1).unwrap_or_else(|| {
                    trimmed.find(' ').unwrap_or(0)
                });
                
                if pos < trimmed.len() {
                    current_verse = trimmed[pos + 1..].trim().to_string();
                }
            }
            
            verse_number += 1;
        } else if trimmed.starts_with("1 ") || trimmed.starts_with("1. ") || trimmed == "1" {
            // This is the first verse
            verse_number = 2;
            
            // Add the line without the verse number if it's more than just the number
            if trimmed.len() > 2 {
                // Find the position after the verse number and period
                let pos = trimmed.find('.').map(|p| p + 1).unwrap_or_else(|| {
                    trimmed.find(' ').unwrap_or(0)
                });
                
                if pos < trimmed.len() {
                    current_verse = trimmed[pos + 1..].trim().to_string();
                }
            }
        } else {
            // This is a continuation of the current verse
            if !current_verse.is_empty() {
                current_verse.push(' ');
            }
            current_verse.push_str(trimmed);
        }
    }
    
    // Add the last verse if we have one
    if !current_verse.is_empty() {
        verses.push(current_verse.trim().to_string());
    }
    
    verses
}
