document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const taskList = document.getElementById('task-list');

    // Função para renderizar as tarefas na tela
    const renderTasks = (tasks = []) => {
        taskList.innerHTML = '';
        if (tasks.length === 0) {
            taskList.innerHTML = '<p class="empty-message">Nenhuma tarefa ainda!</p>';
        } else {
            tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
            tasks.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.classList.add('task-item');
                const formattedDate = new Date(task.date + 'T00:00:00-03:00').toLocaleDateString('pt-BR');

                taskElement.innerHTML = `
                    <div class="task-info">
                        <strong>${task.title}</strong>
                        <span>Entrega: ${formattedDate}</span>
                        <div class="ai-suggestion" id="suggestion-${task.id}"></div>
                    </div>
                    <div class="task-actions">
                        <button class="ai-btn" data-title="${task.title}" data-id="${task.id}" title="Sugerir passos">✨</button>
                        <button class="delete-btn" data-id="${task.id}">&times;</button>
                    </div>
                `;
                taskList.appendChild(taskElement);
            });
        }
    };

    // Carrega as tarefas do storage
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
                chrome.runtime.sendMessage({ type: 'createAlarm', task: newTask });
            });
        });
    });

    // Listener de cliques para os botões de DELETAR e de IA
    taskList.addEventListener('click', async (e) => {
        // Lógica para deletar tarefa
        if (e.target.classList.contains('delete-btn')) {
            const taskIdToDelete = e.target.dataset.id;
            chrome.storage.local.get(['tasks'], (result) => {
                let tasks = result.tasks || [];
                tasks = tasks.filter(task => task.id !== taskIdToDelete);
                chrome.storage.local.set({ tasks }, () => {
                    renderTasks(tasks);
                    chrome.runtime.sendMessage({ type: 'removeAlarm', taskId: taskIdToDelete });
                });
            });
        }

        // Lógica para o botão de IA
        if (e.target.classList.contains('ai-btn')) {
            const button = e.target;
            const taskTitle = button.dataset.title;
            const taskId = button.dataset.id;
            const suggestionArea = document.getElementById(`suggestion-${taskId}`);

            let apiKey = '';
            const result = await chrome.storage.local.get(['apiKey']);
            if (result.apiKey) {
                apiKey = result.apiKey;
            } else {
                apiKey = prompt("Por favor, insira sua Chave de API do Google AI Studio:");
                if (apiKey) {
                    await chrome.storage.local.set({ apiKey });
                }
            }

            if (!apiKey) {
                suggestionArea.innerText = "Chave de API necessária.";
                return;
            }

            button.disabled = true;
            suggestionArea.innerText = "Pensando...";

            try {
                const suggestion = await getAiSuggestion(taskTitle, apiKey);
                suggestionArea.innerText = suggestion;
            } catch (error) {
                suggestionArea.innerText = "Erro ao buscar sugestão. Verifique sua chave ou a conexão.";
                console.error("Erro na API do Gemini:", error);
            } finally {
                button.disabled = false;
            }
        }
    });

    // Função que chama a API do Gemini
    async function getAiSuggestion(taskTitle, apiKey) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        const promptText = `Aja como um tutor universitário experiente. Para a seguinte tarefa de um aluno do CEUB: "${taskTitle}", sugira um plano de ação conciso com 3 a 5 passos claros e objetivos para que ele possa começar e concluir a tarefa. Formate a resposta como uma lista simples (usando hífens ou números).`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Erro na API: ${errorBody.error.message}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
});