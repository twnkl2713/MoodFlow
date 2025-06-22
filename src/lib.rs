use std::thread;
use std::sync::{mpsc, Arc, Mutex};

// type alias for jobs that threads will execute
type Job = Box<dyn FnOnce() + Send + 'static>; // a job is just a task that a robot can run oce, safely and independently

// building the threadpool
pub struct ThreadPool {
    _workers: Vec<Worker>, // the 4 robots
    sender: mpsc::Sender<Job>, // like a task pipeline - where you put jobs in and robots pick them up``
}

impl ThreadPool {
    // Create a new ThreadPool with `size` threads
    pub fn new(size: usize) -> ThreadPool {
        assert!(size > 0);
        
        let (sender, receiver) = mpsc::channel(); // A channel: Like a pipeline — one end sends jobs, the other receives
        let receiver = Arc::new(Mutex::new(receiver)); // Arc<Mutex<>> - safe shared access to the receiver so robots don't fight
        
        let mut workers = Vec::with_capacity(size);
        for id in 0..size {
            workers.push(Worker::new(id, Arc::clone(&receiver)));
        }
        
        ThreadPool { 
            _workers: workers, 
            sender, 
        }
    }

    // Send a job to be executed by the thread pool
    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static
        // this just sends the job to the pipeline, a robot will pick it up
    {
        let job = Box::new(f);
        self.sender.send(job).unwrap();
    }
}

struct Worker {
    _id: usize,
    _thread: thread::JoinHandle<()>,
}

impl Worker {
    fn new(id: usize, receiver: Arc<Mutex<mpsc::Receiver<Job>>>) -> Worker {
        // wait until there's a job
        // picks it up and runs it (job())
        // repeats forever
        let thread = thread::spawn(move || loop {
            let job = receiver.lock().unwrap().recv().unwrap();
            println!("Worker {} executing job", id);
            job();
        });

        Worker { 
            _id: id, 
            _thread: thread,
        }
    }
}