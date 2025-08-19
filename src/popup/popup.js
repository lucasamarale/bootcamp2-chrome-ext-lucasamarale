document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const taskList = document.getElementById('task-list');

    // Função para renderizar as tarefas na tela
    const renderTasks = (tasks = []) => {
        taskList.innerHTML = ''; // Limpa a lista antes de renderizar
        if (tasks.length === 0) {
            taskList.innerHTML = '<p class="empty-message">Nenhuma tarefa ainda!</p>';
        } else {
            // Ordena as tarefas por data
            tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            tasks.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.classList.add('task-item');
                
                // Ajusta a data para evitar problemas de fuso horário na exibição
                const formattedDate = new Date(task.date + 'T00:00:00-03:00').toLocaleDateString('pt-BR');

                taskElement.innerHTML = `
                    <div class="task-info">
                        <strong>${task.title}</strong>
                        <span>Entrega: ${formattedDate}</span>
                    </div>
                    <button class="delete-btn" data-id="${task.id}">&times;</button>
                `;
                taskList.appendChild(taskElement);
            });
        }
    };

    // Carrega as tarefas do storage quando o popup é aberto
    chrome.storage.local.get(['tasks'], (result) => {
        renderTasks(result.tasks);
    });

    // Adiciona uma nova tarefa
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTask = {
            id: `task_${Date.now()}`,
            title: taskTitleInput.value,
            date: taskDateInput.value
        };

        chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            tasks.push(newTask);
            chrome.storage.local.set({ tasks }, () => {
                renderTasks(tasks);
                taskForm.reset();
                // Envia mensagem para o service worker criar um alarme
                chrome.runtime.sendMessage({ type: 'createAlarm', task: newTask });
            });
        });
    });

    // Deleta uma tarefa (usando delegação de eventos)
    taskList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const taskIdToDelete = e.target.dataset.id;
            chrome.storage.local.get(['tasks'], (result) => {
                let tasks = result.tasks || [];
                tasks = tasks.filter(task => task.id !== taskIdToDelete);
                chrome.storage.local.set({ tasks }, () => {
                    renderTasks(tasks);
                    // Opcional: remover o alarme correspondente
                    chrome.runtime.sendMessage({ type: 'removeAlarm', taskId: taskIdToDelete });
                });
            });
        }
    });
});