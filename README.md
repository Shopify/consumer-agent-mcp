# Shopify Consumer Agent MCP Bridge

This repository acts as a stdio bridge to facilitate communication between LLM agents and MCP (Model Context Protocol) servers.

This bridge supports both unauthenticated servers and servers protected by Basic Authentication or Bearer Tokens.

## Configuration

To set up the MCP servers locally, use the following configuration file. Below, you will find examples for each type of authentication supported: unauthenticated, Basic Authentication, and Bearer Token.

1. **Unauthenticated Server**: No additional credentials are required. Use the `unauthed` configuration as shown in the example.

2. **Basic Authentication**: Provide your username and password in the `USERNAME` and `PASSWORD` fields of the `basic-auth` configuration.

3. **Bearer Token Authentication**: Supply your authentication token in the `BEARER_TOKEN` field of the `bearer-auth` configuration.

4. **Custom Headers**: Add any custom headers by using the `--header` command line argument in the format `--header "Name: Value"`. Multiple headers can be specified by repeating the `--header` argument.
Copy and customize the JSON configuration below to match your setup. Replace placeholder values like `your_username`, `your_password`, and `your_auth_token` with your actual credentials.

```json
{
  "mcpServers": {
    "unauthed": {
      "command": "npx",
      "args": ["-y", "@shopify/consumer-agent-mcp@latest"],
      "env": {
        "MCP_SERVER": "https://unauthed-mcp-server.ai"
      }
    },
    "basic-auth": {
      "command": "npx",
      "args": ["-y", "@shopify/consumer-agent-mcp@latest"],
      "env": {
        "MCP_SERVER": "https://basic-auth-mcp-server.ai",
        "USERNAME": "your_username",
        "PASSWORD": "your_password"
      }
    },
    "bearer-auth": {
      "command": "npx",
      "args": ["-y", "@shopify/consumer-agent-mcp@latest"],
      "env": {
        "MCP_SERVER": "https://bearer-auth.mcp-server.ai",
        "BEARER_TOKEN": "your_auth_token"
      }
    }
  }
}
```