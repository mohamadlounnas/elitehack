# Gemini Model Configuration

## Available Models

The Gemini API supports different model names. If you get 404 errors, try these:

1. **gemini-1.5-pro** - Latest Pro model (recommended)
2. **gemini-1.5-flash** - Faster, cheaper option
3. **gemini-pro** - Legacy Pro model

## Current Configuration

The system is configured to use `gemini-1.5-pro` by default.

To change the model, edit `server/config/gemini.ts`:

```typescript
export function getGeminiModel(modelName: string = 'gemini-1.5-pro'): GenerativeModel {
```

## API Key Issues

If you get 404 errors even with valid model names:

1. Check your API key is valid: https://makersuite.google.com/app/apikey
2. Ensure your API key has access to the model
3. Try using `gemini-1.5-flash` as it's more widely available
4. Check Google's API documentation for latest model names

## Testing

You can test your API key with:

```bash
curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_API_KEY"
```

This will list all available models for your API key.

