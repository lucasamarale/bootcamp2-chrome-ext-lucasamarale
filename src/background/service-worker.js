// Listener para quando a extensão é instalada
chrome.runtime.onInstalled.addListener(() => {
    console.log('CEUB Task Manager instalado.');
  });
  
  // Listener para mensagens vindas de outras partes da extensão (como o popup)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'createAlarm') {
          const task = message.task;
          // Alarme para 1 dia antes da data da tarefa, às 9h da manhã
          const reminderTime = new Date(task.date).getTime() - (24 * 60 * 60 * 1000);
  
          if (reminderTime > Date.now()) {
              chrome.alarms.create(`reminder_${task.id}`, {
                  when: reminderTime,
              });
              console.log(`Alarme criado para ${task.title} em ${new Date(reminderTime).toLocaleString()}`);
          }
      } else if (message.type === 'removeAlarm') {
          chrome.alarms.clear(`reminder_${message.taskId}`);
          console.log(`Alarme para ${message.taskId} removido.`);
      }
  });
  
  // Listener para quando um alarme dispara
  chrome.alarms.onAlarm.addListener((alarm) => {
      const taskId = alarm.name.replace('reminder_', '');
      
      // Busca a tarefa no storage para obter o título
      chrome.storage.local.get(['tasks'], (result) => {
          const task = result.tasks.find(t => t.id === taskId);
          if (task) {
              chrome.notifications.create(`notify_${taskId}`, {
                  type: 'basic',
                  iconUrl: 'icons/icon128.png',
                  title: 'Lembrete de Tarefa!',
                  message: `Não se esqueça: "${task.title}" é para amanhã!`,
                  priority: 2
              });
          }
      });
  });