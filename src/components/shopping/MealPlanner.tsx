'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, Button } from '@/components/ui';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function MealPlanner() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startConversation = async () => {
    setLoading(true);
    setStarted(true);
    try {
      const res = await fetch('/api/ai/meal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await res.json();
      setMessages([{ role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = { role: 'user' as const, content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/meal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });
      const data = await res.json();
      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setStarted(false);
  };

  if (!started) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">🥗</div>
          <h3 className="text-xl font-semibold">AI Meal Planner</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Get a personalized meal plan and shopping list based on your health goals, dietary preferences, and lifestyle.
          </p>
          <Button onClick={startConversation} disabled={loading}>
            {loading ? 'Starting...' : 'Start Planning'}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">🥗 AI Meal Planner</h3>
        <button onClick={resetChat} className="text-sm text-gray-500 hover:text-gray-700">
          Reset
        </button>
      </div>
      
      <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white border shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your response..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </Card>
  );
}
