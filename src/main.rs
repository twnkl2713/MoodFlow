use std::net::{TcpListener, TcpStream};
use std::io::prelude::*;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use mime_guess::from_path;
use server::ThreadPool;
use serde::{Deserialize, Serialize};

const DB_FILE: &str = "data/entries.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Entry {
    date: String,
    text: String,
    mood: String,
}

fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();
    println!("Server running on http://127.0.0.1:7878");

    let pool = ThreadPool::new(4);
    let entries = Arc::new(Mutex::new(load_entries()));

    for stream in listener.incoming() {
        let stream = stream.unwrap();
        let entries_clone = Arc::clone(&entries);
        pool.execute(move || {
            handle_connection(stream, entries_clone);
        });
    }

    println!("Shutting down server!");
}

fn handle_connection(mut stream: TcpStream, entries: Arc<Mutex<Vec<Entry>>>) {
    let mut buffer = [0; 1024 * 8];
    stream.read(&mut buffer).unwrap();

    let request = String::from_utf8_lossy(&buffer);
    let request_line = request.lines().next().unwrap_or("");
    let mut parts = request_line.split_whitespace();

    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");

    if path.starts_with("/api/entries") {
        match method {
            "GET" => handle_get_entries(&mut stream, &entries),
            "POST" => handle_post_entries(&mut stream, &request, &entries),
            _ => respond_with_file(&mut stream, "HTTP/1.1 405 METHOD NOT ALLOWED", "static/404.html"),
        }
        return;
    }

    if path == "/api/delete" && method == "POST" {
        handle_delete_entry(&mut stream, &request, &entries);
        return;
    }

    let mut file_path = match path {
        "/" => "static/index.html".to_string(),
        _ => format!("static{}", path),
    };

    if !file_path.contains('.') {
        file_path.push_str(".html");
    }

    let (status_line, file_path) = if Path::new(&file_path).exists() {
        ("HTTP/1.1 200 OK", file_path)
    } else {
        ("HTTP/1.1 404 NOT FOUND", "static/404.html".to_string())
    };

    respond_with_file(&mut stream, status_line, &file_path);
}

fn respond_with_file(stream: &mut TcpStream, status: &str, file_path: &str) {
    let contents = fs::read(file_path).unwrap_or_else(|_| b"<h1>500 Internal Server Error</h1>".to_vec());
    let content_type = from_path(file_path).first_or_octet_stream();

    let header = format!(
        "{status}\r\nContent-Length: {}\r\nContent-Type: {content_type}\r\n\r\n",
        contents.len(),
        content_type = content_type
    );

    stream.write_all(header.as_bytes()).unwrap();
    stream.write_all(&contents).unwrap();
    stream.flush().unwrap();
}

fn handle_get_entries(stream: &mut TcpStream, entries: &Arc<Mutex<Vec<Entry>>>) {
    let data = {
        let entries = entries.lock().unwrap();
        serde_json::to_string_pretty(&*entries).unwrap()
    };

    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/json\r\n\r\n",
        data.len()
    );

    stream.write_all(header.as_bytes()).unwrap();
    stream.write_all(data.as_bytes()).unwrap();
}

fn handle_post_entries(stream: &mut TcpStream, request: &str, entries: &Arc<Mutex<Vec<Entry>>>) {
    let body_start = request.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    let body = &request[body_start..];

    let incoming: serde_json::Result<serde_json::Value> = serde_json::from_str(body);
    if let Ok(json) = incoming {
        if let Some(text) = json.get("text").and_then(|v| v.as_str()) {
            let mood = classify_mood(text);
            let date = chrono::Local::now().format("%Y-%m-%d").to_string();

            let new_entry = Entry {
                date,
                text: text.to_string(),
                mood,
            };

            {
                let mut entries = entries.lock().unwrap();
                entries.push(new_entry.clone());
                save_entries(&*entries);
            }

            let response = "HTTP/1.1 201 CREATED\r\nContent-Length: 0\r\n\r\n";
            stream.write_all(response.as_bytes()).unwrap();
            return;
        }
    }

    let response = "HTTP/1.1 400 BAD REQUEST\r\nContent-Length: 0\r\n\r\n";
    stream.write_all(response.as_bytes()).unwrap();
}

fn handle_delete_entry(stream: &mut TcpStream, request: &str, entries: &Arc<Mutex<Vec<Entry>>>) {
    let body_start = request.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    let body = &request[body_start..];

    #[derive(Deserialize)]
    struct DeleteRequest {
        index: usize,
    }

    let parsed: serde_json::Result<DeleteRequest> = serde_json::from_str(body);
    if let Ok(req) = parsed {
        let mut entries = entries.lock().unwrap();
        if req.index < entries.len() {
            entries.remove(req.index);
            save_entries(&entries);

            let response = "HTTP/1.1 204 NO CONTENT\r\nContent-Length: 0\r\n\r\n";
            stream.write_all(response.as_bytes()).unwrap();
            return;
        }
    }

    let response = "HTTP/1.1 400 BAD REQUEST\r\nContent-Length: 0\r\n\r\n";
    stream.write_all(response.as_bytes()).unwrap();
}

fn classify_mood(text: &str) -> String {
    let text = text.to_lowercase();

    // Normalize some common abbreviations
    let normalized = text
        .replace("wtf", "what the fuck")
        .replace("tf", "the fuck")
        .replace("fml", "fuck my life")
        .replace("idk", "i don't know");

    let happy_keywords = [
        "happy", "joy", "joyful", "grateful", "excited", "relaxed", "fun", "peaceful",
        "great", "amazing", "awesome", "good", "smile", "love", "yay", "yay!", "chill",
    ];

    let sad_keywords = [
        "sad", "cry", "lonely", "depressed", "gloomy", "miserable", "down", "hurt", "die",
        "hopeless", "worthless", "sorrow", "tears", "lost", "numb", "blue", "suicide", "suicidal",
    ];

    let stressed_keywords = [
        "stress", "stressed", "anxious", "panic", "grind", "burnout", "tired",
        "angry", "mad", "frustrated", "exhausted", "drained", "fuck", "fucked",
        "bullshit", "shit", "what the fuck", "wtf", "tf", "hate", "screaming",
        "useless", "trash", "overwhelmed", "rage", "fuck this", "fuck the world",
        "fuck my life", "burnt out", "done with everything", "idk", "man",
    ];

    let neutral_keywords = [
        "okay", "fine", "meh", "normal", "average", "alright", "not bad", "so-so",
        "whatever", "idc", "mid",
    ];

    let mut scores = [0; 4]; // [Happy, Sad, Stressed, Neutral]

    for word in happy_keywords.iter() {
        if normalized.contains(word) {
            scores[0] += 1;
        }
    }
    for word in sad_keywords.iter() {
        if normalized.contains(word) {
            scores[1] += 1;
        }
    }
    for word in stressed_keywords.iter() {
        if normalized.contains(word) {
            scores[2] += 1;
        }
    }
    for word in neutral_keywords.iter() {
        if normalized.contains(word) {
            scores[3] += 1;
        }
    }

    let max_score = *scores.iter().max().unwrap_or(&0);

    if max_score == 0 {
        return "Neutral".to_string(); // no match
    }

    let labels = ["Happy", "Sad", "Stressed", "Neutral"];

    // Prioritize stressed > sad > happy > neutral on tie
    let mut max_index = 0;
    for i in 1..scores.len() {
        if scores[i] >= scores[max_index] {
            max_index = i;
        }
    }

    labels[max_index].to_string()
}

fn load_entries() -> Vec<Entry> {
    fs::read_to_string(DB_FILE)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

fn save_entries(entries: &Vec<Entry>) {
    let json_data = serde_json::to_string_pretty(entries).unwrap();
    fs::write(DB_FILE, json_data).unwrap();
}
