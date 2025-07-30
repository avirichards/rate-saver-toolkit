interface BackgroundTask {
  id: string;
  type: 'analysis' | 'validation' | 'export';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  current: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

class BackgroundProcessor {
  private tasks = new Map<string, BackgroundTask>();
  private workers: Worker[] = [];
  private maxWorkers = 4;

  constructor() {
    this.initializeWorkers();
  }

  private initializeWorkers() {
    // Create web workers for background processing
    try {
      for (let i = 0; i < this.maxWorkers; i++) {
        const worker = new Worker(new URL('../workers/analysisWorker.ts', import.meta.url));
        worker.onmessage = this.handleWorkerMessage.bind(this);
        (worker as any).busy = false; // Add busy flag
        this.workers.push(worker);
      }
    } catch (error) {
      console.warn('Web Workers not supported, falling back to main thread processing');
      this.maxWorkers = 0;
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { taskId, type, data, error } = event.data;
    const task = this.tasks.get(taskId);
    
    if (!task) return;

    switch (type) {
      case 'progress':
        task.progress = data.progress;
        task.current = data.current;
        task.updatedAt = new Date();
        break;
      
      case 'completed':
        task.status = 'completed';
        task.result = data;
        task.progress = 100;
        task.updatedAt = new Date();
        break;
      
      case 'error':
        task.status = 'failed';
        task.error = error;
        task.updatedAt = new Date();
        break;
    }

    // Notify subscribers
    this.notifyTaskUpdate(taskId);
  }

  private notifyTaskUpdate(taskId: string) {
    // Dispatch custom event for task updates
    window.dispatchEvent(new CustomEvent('backgroundTaskUpdate', {
      detail: { taskId, task: this.tasks.get(taskId) }
    }));
  }

  async submitTask(
    type: BackgroundTask['type'],
    data: any,
    total: number
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: BackgroundTask = {
      id: taskId,
      type,
      status: 'pending',
      progress: 0,
      total,
      current: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tasks.set(taskId, task);

    // Find available worker
    const availableWorker = this.workers.find(worker => 
      !(worker as any).busy
    );

    if (availableWorker) {
      (availableWorker as any).busy = true;
      availableWorker.postMessage({
        taskId,
        type,
        data,
        total
      });
    } else {
      // Queue task for later processing
      this.queueTask(taskId, type, data, total);
    }

    return taskId;
  }

  private queueTask(taskId: string, type: string, data: any, total: number) {
    // Simple queue implementation
    setTimeout(() => {
      const availableWorker = this.workers.find(worker => !(worker as any).busy);
      if (availableWorker) {
        (availableWorker as any).busy = true;
        availableWorker.postMessage({
          taskId,
          type,
          data,
          total
        });
      }
    }, 1000);
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'pending') {
      task.status = 'failed';
      task.error = 'Cancelled by user';
      task.updatedAt = new Date();
      this.notifyTaskUpdate(taskId);
      return true;
    }
    return false;
  }

  clearCompletedTasks(): void {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed' || task.status === 'failed');
    
    completedTasks.forEach(([taskId]) => {
      this.tasks.delete(taskId);
    });
  }

  // Memory management
  cleanup(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.tasks.clear();
  }
}

// Singleton instance
export const backgroundProcessor = new BackgroundProcessor();

// Hook for using background tasks
export const useBackgroundTasks = () => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => {
    const handleTaskUpdate = (event: CustomEvent) => {
      setTasks(backgroundProcessor.getAllTasks());
    };

    window.addEventListener('backgroundTaskUpdate', handleTaskUpdate as EventListener);
    
    // Initial load
    setTasks(backgroundProcessor.getAllTasks());

    return () => {
      window.removeEventListener('backgroundTaskUpdate', handleTaskUpdate as EventListener);
    };
  }, []);

  return {
    tasks,
    submitTask: backgroundProcessor.submitTask.bind(backgroundProcessor),
    getTask: backgroundProcessor.getTask.bind(backgroundProcessor),
    cancelTask: backgroundProcessor.cancelTask.bind(backgroundProcessor),
    clearCompletedTasks: backgroundProcessor.clearCompletedTasks.bind(backgroundProcessor)
  };
}; 