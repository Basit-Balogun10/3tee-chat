import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// AI SDK Migration Script - Phase 1
// Backfills existing messages with rawParts and renderedText for AI SDK compatibility
export const migrateMessagesToAISDKFormat = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    processed: v.number(),
    migrated: v.number(),
    skipped: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, { batchSize = 100, dryRun = false }) => {
    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Get messages that need migration (no contentFormatVersion or version 1)
    const messagesToMigrate = await ctx.db
      .query("messages")
      .filter((q) => 
        q.or(
          q.eq(q.field("contentFormatVersion"), undefined),
          q.eq(q.field("contentFormatVersion"), 1)
        )
      )
      .take(batchSize);

    console.log(`🔄 AI SDK Migration: Found ${messagesToMigrate.length} messages to migrate`);

    for (const message of messagesToMigrate) {
      try {
        processed++;

        // Skip if already has rawParts (partially migrated)
        if (message.rawParts) {
          skipped++;
          continue;
        }

        if (!dryRun) {
          // Create rawParts from legacy content
          const rawParts = [
            {
              type: 'text',
              text: message.content || '',
            }
          ];

          // Add image parts from attachments if they exist
          if (message.attachments) {
            for (const attachment of message.attachments) {
              if (attachment.type === 'image') {
                // Convert attachment to AI SDK image part format
                rawParts.push({
                  type: 'image',
                  image: {
                    storageId: attachment.storageId,
                    name: attachment.name,
                    size: attachment.size,
                  }
                });
              } else {
                // Convert other attachments to file parts
                rawParts.push({
                  type: 'file',
                  file: {
                    storageId: attachment.storageId,
                    name: attachment.name,
                    size: attachment.size,
                    mimeType: attachment.type,
                  }
                });
              }
            }
          }

          // Update message with AI SDK format
          await ctx.db.patch(message._id, {
            rawParts,
            renderedText: message.content || '', // Keep original content as rendered text
            contentFormatVersion: 2, // Mark as migrated to new format
          });
        }

        migrated++;

        // Log progress every 10 messages
        if (processed % 10 === 0) {
          console.log(`🔄 Progress: ${processed}/${messagesToMigrate.length} processed`);
        }

      } catch (error) {
        console.error(`❌ Error migrating message ${message._id}:`, error);
        errors++;
      }
    }

    const result = {
      processed,
      migrated,
      skipped,
      errors,
    };

    console.log(`✅ AI SDK Migration completed:`, result);
    return result;
  },
});

// Helper function to convert attachments to AI SDK parts format
function convertAttachmentsToParts(attachments: any[]): any[] {
  return attachments.map(attachment => {
    switch (attachment.type) {
      case 'image':
        return {
          type: 'image',
          image: {
            storageId: attachment.storageId,
            name: attachment.name,
            size: attachment.size,
          }
        };
      case 'pdf':
      case 'file':
        return {
          type: 'file',
          file: {
            storageId: attachment.storageId,
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.type,
          }
        };
      case 'audio':
        return {
          type: 'audio',
          audio: {
            storageId: attachment.storageId,
            name: attachment.name,
            size: attachment.size,
          }
        };
      case 'video':
        return {
          type: 'video',
          video: {
            storageId: attachment.storageId,
            name: attachment.name,
            size: attachment.size,
          }
        };
      default:
        return {
          type: 'file',
          file: {
            storageId: attachment.storageId,
            name: attachment.name,
            size: attachment.size,
            mimeType: 'application/octet-stream',
          }
        };
    }
  });
}