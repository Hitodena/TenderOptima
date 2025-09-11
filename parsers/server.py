#!/usr/bin/env python3
import asyncio
import json
from flask import Flask, request, jsonify
from main import parse

app = Flask(__name__)

@app.route('/search', methods=['POST'])
async def search():
    try:
        data = request.get_json()
        query = data.get('query')
        elements = data.get('elements', 10)
        user_id = data.get('user_id')
        region = data.get('region', 'by')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
            
        # Определяем доступные поисковые системы
        search_engines = ["google"]  # По умолчанию всегда используем Google
        
        results = await parse(query, user_id, elements, region, search_engines)
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
