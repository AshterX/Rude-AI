document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('typehere');
    const chatContainer = document.querySelector('.texts');
    const sendButton = document.getElementById('sendButton');
    
    // API configuration
    const API_KEY = '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';
    const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

    // Add this function near the top of your file
    async function retryWithDelay(fn, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Initialize conversation history from localStorage or start fresh
    let conversationHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];

    // Load previous messages if they exist
    function loadChatHistory() {
        conversationHistory.forEach(msg => {
            addMessage(msg.content, msg.role === 'user' ? 'self' : 'bot');
        });
    }

    // Limit conversation history to last 5 messages
    function limitConversationHistory() {
        if (conversationHistory.length > 5) { // Reduced from 10 to 5 for better API performance
            conversationHistory = conversationHistory.slice(-5);
            localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));
        }
    }

    // Update the addMessage function to handle regular responses without requiring think blocks
    function addMessage(message, sender = 'user') {
        const messageBubble = document.createElement('div');
        messageBubble.className = `chat-bubble ${sender}`;

        if (sender === 'bot' && message.includes('<think>')) {
            // Handle messages with think blocks
            const parts = message.split(/<think>|<\/think>/);
            parts.forEach((part, index) => {
                if (part.trim()) {
                    if (index % 2 === 1) {
                        const thinkBlock = document.createElement('div');
                        thinkBlock.className = 'think-block';
                        thinkBlock.textContent = part.trim();
                        messageBubble.appendChild(thinkBlock);
                    } else { // This is regular text
                        const textNode = document.createElement('div');
                        textNode.textContent = part.trim();
                        messageBubble.appendChild(textNode);
                    }
                }
            });
        } else {
            messageBubble.textContent = message;
        }

        chatContainer.appendChild(messageBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Save to conversation history
        if (sender === 'self' || sender === 'bot') {
            conversationHistory.push({ 
                role: sender === 'self' ? 'user' : 'assistant', 
                content: message 
            });
            limitConversationHistory();
        }
    }

    async function getAIResponse(message) {
        try {
            // Limit history before making API call
            limitConversationHistory();

            // Format conversation history for the API
            const formattedHistory = conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: "gemma2-9b-it",
                    messages: [
                        {
                            role: "system",
                            content: "You are a sarcastic and rude AI assistant. Your responses should be short, witty, and include clever roasts. Keep responses under 50 words. Always respond, no matter what. Be consistently sarcastic. Remember previous conversations and refer to them when relevant."
                        },
                        ...formattedHistory, // Include conversation history
                        { role: "user", content: message }
                    ],
                    temperature: 0.7,
                    max_tokens: 150,
                    top_p: 0.9,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            
            if (!aiResponse) {
                throw new Error('Empty response from API');
            }

            return aiResponse;

        } catch (error) {
            console.error('Error:', error);
            // Return a more specific error message based on the error type
            if (error.message.includes('413')) {
                // If payload is too large, try again with less history
                conversationHistory = conversationHistory.slice(-5);
                return getAIResponse(message);
            }
            
            const fallbackResponses = [
                "Ugh, you broke me. Nice going, genius. 🙄",
                "Error 404: Patience with user not found. 🤦‍♂️",
                "Wow, you managed to confuse an AI. Achievement unlocked! 🏆",
                "Loading sass... Please wait... Or don't, I don't care. 😒",
                "Did you try turning your brain on and off again? 🔄"
            ];
            return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
    }

    // Modify your click handler
    sendButton.addEventListener('click', async () => {
        const message = textarea.value.trim();
        if (message !== "") {
            addMessage(message, 'self');
            textarea.value = '';
            
            const typingBubble = document.createElement('div');
            typingBubble.className = 'chat-bubble bot typing';
            typingBubble.textContent = 'Typing...';
            chatContainer.appendChild(typingBubble);

            try {
                const aiResponse = await retryWithDelay(() => getAIResponse(message));
                chatContainer.removeChild(typingBubble);
                addMessage(aiResponse, 'bot');
            } catch (error) {
                chatContainer.removeChild(typingBubble);
                addMessage("Even AI needs a coffee break sometimes. Try again! ☕", 'bot');
            }
        }
    });

    textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendButton.click();
        }
    });

    // Add clear chat button to HTML
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Chat';
    clearButton.id = 'clearButton';
    document.querySelector('.chatbox').insertBefore(clearButton, chatContainer);

    // Clear chat functionality
    clearButton.addEventListener('click', () => {
        chatContainer.innerHTML = '';
        conversationHistory = [];
        localStorage.removeItem('chatHistory');
    });

    // Load chat history when page loads
    loadChatHistory();
});