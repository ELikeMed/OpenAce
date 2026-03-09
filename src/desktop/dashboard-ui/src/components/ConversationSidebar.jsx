import { Box, Typography, IconButton, List, ListItemButton, alpha, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MenuIcon from '@mui/icons-material/Menu';
import { BRAND } from '../theme';

const SIDEBAR_WIDTH = 280;

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  collapsed,
  onToggleCollapse,
}) {
  if (collapsed) {
    return (
      <Box sx={{
        width: 48,
        borderRight: `1px solid ${BRAND.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pt: 1,
        flexShrink: 0,
      }}>
        <Tooltip title="Expand conversations" placement="right">
          <IconButton onClick={onToggleCollapse} size="small"
            sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.primary } }}>
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="New chat" placement="right">
          <IconButton onClick={onNewConversation} size="small" sx={{ mt: 1, color: BRAND.primary }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{
      width: SIDEBAR_WIDTH,
      borderRight: `1px solid ${BRAND.border}`,
      display: 'flex',
      flexDirection: 'column',
      background: alpha(BRAND.bgCard, 0.5),
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${BRAND.border}`,
      }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: BRAND.textPrimary }}>
          Conversations
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="New chat">
            <IconButton size="small" onClick={onNewConversation}
              sx={{
                color: BRAND.primary,
                background: alpha(BRAND.primary, 0.08),
                '&:hover': { background: alpha(BRAND.primary, 0.15) },
              }}>
              <AddIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Collapse">
            <IconButton size="small" onClick={onToggleCollapse}
              sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.primary } }}>
              <MenuIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Conversation List */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {conversations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 40, color: BRAND.textMuted, mb: 1 }} />
            <Typography sx={{ fontSize: '0.9rem', color: BRAND.textMuted }}>
              No conversations yet. Start a new chat!
            </Typography>
          </Box>
        ) : (
          <List sx={{ px: 0.5 }}>
            {conversations.map((conv) => {
              const isActive = conv.chatId === activeConversationId;
              return (
                <ListItemButton
                  key={conv.chatId}
                  selected={isActive}
                  onClick={() => onSelectConversation(conv.chatId)}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.25,
                    mx: 0.5,
                    py: 1,
                    px: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    '&.Mui-selected': {
                      background: alpha(BRAND.primary, 0.12),
                      borderLeft: `3px solid ${BRAND.primary}`,
                    },
                    '&:hover .delete-btn': { opacity: 1 },
                  }}
                >
                  <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography noWrap sx={{
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? BRAND.textPrimary : BRAND.textSecondary,
                      flex: 1,
                      mr: 1,
                    }}>
                      {conv.title || 'New conversation'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted, flexShrink: 0 }}>
                      {formatTimestamp(conv.lastMessage?.timestamp)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                    <Typography noWrap sx={{ fontSize: '0.8rem', color: BRAND.textMuted, flex: 1 }}>
                      {conv.lastMessage?.content?.substring(0, 40) || ''}
                    </Typography>
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.chatId); }}
                      sx={{
                        opacity: 0, transition: 'opacity 0.2s',
                        p: 0.25, color: BRAND.textMuted,
                        '&:hover': { color: BRAND.error },
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
}

export default ConversationSidebar;
