document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do HTML
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const taskTimeInput = document.getElementById('task-time'); // Novo
    const saveToCalendarCheckbox = document.getElementById('save-to-calendar'); // Novo
    const taskList = document.getElementById('task-list');

    // --- FUNÇÕES DE RENDERIZAÇÃO E LÓGICA LOCAL ---

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
                        <span>Entrega: ${formattedDate} ${task.time || ''}</span>
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

    // Carrega as tarefas salvas localmente ao abrir o popup
    chrome.storage.local.get(['tasks'], (result) => {
        renderTasks(result.tasks);
    });

    // Listener para o envio do formulário
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const newTask = {
            id: `task_${Date.now()}`,
            title: taskTitleInput.value,
            date: taskDateInput.value,
            time: taskTimeInput.value
        };

        // 1. Salva a tarefa na lista local da extensão
        chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            tasks.push(newTask);
            chrome.storage.local.set({ tasks }, () => {
                renderTasks(tasks);
                taskForm.reset();
                chrome.runtime.sendMessage({ type: 'createAlarm', task: newTask });
            });
        });

        // 2. Se o checkbox estiver marcado, chama a função do Google Agenda
        if (saveToCalendarCheckbox.checked) {
            addToGoogleCalendar(newTask);
        }
    });

    // Listener para os botões de DELETAR e de IA (sem alterações)
    taskList.addEventListener('click', async (e) => {
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

        if (e.target.classList.contains('ai-btn')) {
            // ... (código da IA continua o mesmo, sem alterações)
        }
    });


    // --- FUNÇÕES DE INTEGRAÇÃO COM APIS EXTERNAS ---

    // Função que chama a API do Gemini (sem alterações)
    async function getAiSuggestion(taskTitle, apiKey) { /* ... código da IA aqui ... */ }

    /**
     * NOVA FUNÇÃO: Lida com a autorização e cria um evento no Google Agenda.
     */
    function addToGoogleCalendar(task) {
        // 1. Pede ao Chrome um token de autenticação.
        // O `interactive: true` faz com que a tela de login/permissão apareça para o usuário na primeira vez.
        chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
            if (chrome.runtime.lastError || !token) {
                console.error(chrome.runtime.lastError);
                alert("Não foi possível obter a autorização do Google. Tente novamente.");
                return;
            }

            // 2. Prepara os detalhes do evento para a API
            let startDateTime, endDateTime;
            
            if (task.time) {
                // Se o usuário especificou um horário, cria um evento de 1 hora de duração
                startDateTime = new Date(`${task.date}T${task.time}:00`).toISOString();
                let endDate = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000); // Adiciona 1 hora
                endDateTime = endDate.toISOString();
            } else {
                // Se não especificou horário, cria um evento de "dia inteiro"
                startDateTime = task.date;
                let nextDay = new Date(new Date(task.date).getTime() + 24 * 60 * 60 * 1000);
                endDateTime = nextDay.toISOString().split('T')[0];
            }

            const event = {
                'summary': task.title,
                'start': task.time ? { 'dateTime': startDateTime, 'timeZone': 'America/Sao_Paulo' } : { 'date': startDateTime },
                'end': task.time ? { 'dateTime': endDateTime, 'timeZone': 'America/Sao_Paulo' } : { 'date': endDateTime }
            };

            // 3. Envia o evento para a API do Google Calendar
            fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error.message);
                }
                console.log('Evento criado com sucesso! Link:', data.htmlLink);
                // Aqui você poderia mostrar uma pequena notificação de sucesso para o usuário
            })
            .catch(error => {
                console.error('Erro ao criar evento:', error);
                alert("Ocorreu um erro ao salvar no Google Agenda. Verifique o console para mais detalhes.");
            });
        });
    }
});
