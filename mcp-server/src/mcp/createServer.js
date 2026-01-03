import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {CallToolRequestSchema, ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";
import {FMG_FORMATS} from "./formats.js";

const exportInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    seed: {type: "string", description: "Seed FMG (opzionale)"},
    format: {
      type: "string",
      description: "Formato di export",
      enum: FMG_FORMATS.map(f => f.id)
    },
    options: {
      type: "object",
      description: "Opzioni specifiche per formato",
      additionalProperties: true,
      properties: {
        fullMap: {type: "boolean"},
        debug: {type: "boolean"},
        noLabels: {type: "boolean"},
        noWater: {type: "boolean"},
        noScaleBar: {type: "boolean"},
        noIce: {type: "boolean"},
        noVignette: {type: "boolean"},
        resolution: {type: "number", description: "Scala raster (png/jpeg)"},
        quality: {type: "number", description: "Qualità JPEG (0..1)"},
        tilesX: {type: "number"},
        tilesY: {type: "number"},
        tileScale: {type: "number"}
      }
    }
  },
  required: ["format"]
};

export function createMcpServer({exporter}) {
  const server = new Server(
    {name: "fantasy-map-generator", version: "0.1.0"},
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "fmg_formats",
          description: "Lista formati supportati dal server FMG",
          inputSchema: {type: "object", additionalProperties: false, properties: {}}
        },
        {
          name: "fmg_export",
          description: "Genera (da seed) ed esporta una mappa in un formato",
          inputSchema: exportInputSchema
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const name = request.params.name;

    if (name === "fmg_formats") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({formats: FMG_FORMATS}, null, 2)
          }
        ]
      };
    }

    if (name === "fmg_export") {
      const {seed, format, options} = request.params.arguments ?? {};
      const result = await exporter.export({seed, format, options});

      if (result.mimeType === "image/png" || result.mimeType === "image/jpeg") {
        return {
          content: [
            {type: "image", mimeType: result.mimeType, data: result.base64},
            {
              type: "text",
              text: JSON.stringify(
                {filename: result.filename, mimeType: result.mimeType, sizeBytes: result.sizeBytes},
                null,
                2
              )
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                filename: result.filename,
                mimeType: result.mimeType,
                sizeBytes: result.sizeBytes,
                encoding: "base64",
                data: result.base64
              },
              null,
              2
            )
          }
        ]
      };
    }

    return {
      content: [{type: "text", text: `Unknown tool: ${name}`}]
    };
  });

  return server;
}

