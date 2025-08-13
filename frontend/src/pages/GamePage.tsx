import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, ArrowLeft, Users, BarChart3, Download, Clock, Save, Share2, CheckCircle, PlayCircle } from 'lucide-react';
import { gamesApi, defendersApi, pointsApi, selectedDefendersApi } from '../lib/api';
import { socketManager } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';
import CallYourLine from '../components/CallYourLine';
import SortableTableHeader, { useSortableData } from '../components/SortableTableHeader';

interface GamePageProps {
  isPublic?: boolean;
}

export default function GamePage({ isPublic = false }: GamePageProps) {
  const { gameId, shareCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  
  const [currentPoint, setCurrentPoint] = useState<any[]>([]);
  const [expandedPoints, setExpandedPoints] = useState<string[]>([]);
  const [newOffenderName, setNewOffenderName] = useState('');
  const [newOffenderPosition, setNewOffenderPosition] = useState('HANDLER');
  const [lastButtonClicked, setLastButtonClicked] = useState<string | null>(null);
  const [draggedDefender, setDraggedDefender] = useState<any | null>(null);
  const [dragOverPlayer, setDragOverPlayer] = useState<string | null>(null);
  const [draggedPlayer, setDraggedPlayer] = useState<any | null>(null);
  const [dragOverBench, setDragOverBench] = useState(false);
  const [autoScrollInterval, setAutoScrollInterval] = useState<NodeJS.Timeout | null>(null);
  const [touchTimeout, setTouchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [draggedRowHTML, setDraggedRowHTML] = useState<string>('');
  const [pointStartTime, setPointStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [selectedDefenderIds, setSelectedDefenderIds] = useState<string[]>([]);

  // Offensive positions
  const offensivePositions = [
    'HANDLER',
    'CUTTER',
    'CENTER_HANDLER',
    'RESET_HANDLER',
    'FRONT_OF_STACK',
    'INITIATING_CUTTER',
    'FILL_CUTTER',
    'DEEP_CUTTER'
  ];

  // Fetch game data
  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId || shareCode],
    queryFn: async () => {
      if (isPublic && shareCode) {
        return gamesApi.getPublic(shareCode);
      }
      return gamesApi.get(gameId!);
    },
    enabled: !!(gameId || shareCode)
  });

  // Fetch team defenders
  const { data: defenders = [] } = useQuery({
    queryKey: ['defenders', game?.teamId],
    queryFn: () => defendersApi.listByTeam(game.teamId),
    enabled: !!game?.teamId && !isPublic
  });

  // Add offensive player mutation
  const addOffensivePlayerMutation = useMutation({
    mutationFn: (data: any) => gamesApi.addOffensivePlayer(game.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      setNewOffenderName('');
    }
  });

  // Reorder offensive players mutation
  const reorderOffensivePlayersMutation = useMutation({
    mutationFn: ({ gameId, playerIds }: { gameId: string, playerIds: string[] }) => 
      gamesApi.reorderOffensivePlayers(gameId, playerIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
    }
  });

  // Update offensive player mutation
  const updateOffensivePlayerMutation = useMutation({
    mutationFn: ({ playerId, data }: any) => 
      gamesApi.updateOffensivePlayer(game.id, playerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
    }
  });

  // Delete offensive player mutation
  const deleteOffensivePlayerMutation = useMutation({
    mutationFn: (playerId: string) => 
      gamesApi.deleteOffensivePlayer(game.id, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
    }
  });

  // Create point mutation
  const createPointMutation = useMutation({
    mutationFn: (data: any) => pointsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      setCurrentPoint([]);
      setUnsavedChanges(false);
      setPointStartTime(null);
      setElapsedTime(0);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    }
  });

  // Delete point mutation
  const deletePointMutation = useMutation({
    mutationFn: (pointId: string) => pointsApi.delete(pointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
    }
  });

  // Update game status mutation
  const updateGameStatusMutation = useMutation({
    mutationFn: (status: string) => gamesApi.update(game?.id || '', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      alert('Game marked as complete!');
    }
  });

  // Timer for elapsed time on current point
  useEffect(() => {
    if (pointStartTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - pointStartTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pointStartTime]);

  // Removed auto-complete functionality - games now only complete when user explicitly presses complete button

  // WebSocket setup
  useEffect(() => {
    if (game?.id && isAuthenticated) {
      socketManager.joinGame(game.id);

      const handleGameUpdate = (data: any) => {
        console.log('Game update received:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      };

      const handlePointUpdate = (data: any) => {
        console.log('Point update received:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      };

      const handleMatchupUpdate = (data: any) => {
        console.log('Matchup update received:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      };

      const handleAvailableDefenderAdded = (data: any) => {
        console.log('Available defender added:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      };

      const handleAvailableDefenderRemoved = (data: any) => {
        console.log('Available defender removed:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      };

      const handleCurrentPointDefenderUpdated = (data: any) => {
        console.log('Current point defender updated:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
        if (data.userId !== user?.id) {
          setUnsavedChanges(true);
        }
      };

      const handleCurrentPointCleared = (data: any) => {
        console.log('Current point cleared:', data);
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
        setUnsavedChanges(false);
        setPointStartTime(null);
        setElapsedTime(0);
      };

      const handleOffensivePlayerUpdate = (data: any) => {
        console.log('Offensive player update received - event type:', data);
        // Force refetch immediately
        queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
        queryClient.refetchQueries({ queryKey: ['game', gameId || shareCode] });
      };

      // Register all event handlers
      socketManager.on('game-updated', handleGameUpdate);
      socketManager.on('point-created', handlePointUpdate);
      socketManager.on('point-updated', handlePointUpdate);
      socketManager.on('point-deleted', handlePointUpdate);
      socketManager.on('matchup-updated', handleMatchupUpdate);
      socketManager.on('available-defender-added', handleAvailableDefenderAdded);
      socketManager.on('available-defender-removed', handleAvailableDefenderRemoved);
      socketManager.on('current-point-defender-updated', handleCurrentPointDefenderUpdated);
      socketManager.on('current-point-cleared', handleCurrentPointCleared);
      socketManager.on('player-added', handleOffensivePlayerUpdate);
      socketManager.on('player-updated', handleOffensivePlayerUpdate);
      socketManager.on('player-removed', handleOffensivePlayerUpdate);
      socketManager.on('players-reordered', handleOffensivePlayerUpdate);

      return () => {
        socketManager.off('game-updated', handleGameUpdate);
        socketManager.off('point-created', handlePointUpdate);
        socketManager.off('point-updated', handlePointUpdate);
        socketManager.off('point-deleted', handlePointUpdate);
        socketManager.off('matchup-updated', handleMatchupUpdate);
        socketManager.off('available-defender-added', handleAvailableDefenderAdded);
        socketManager.off('available-defender-removed', handleAvailableDefenderRemoved);
        socketManager.off('current-point-defender-updated', handleCurrentPointDefenderUpdated);
        socketManager.off('current-point-cleared', handleCurrentPointCleared);
        socketManager.off('player-added', handleOffensivePlayerUpdate);
        socketManager.off('player-updated', handleOffensivePlayerUpdate);
        socketManager.off('player-removed', handleOffensivePlayerUpdate);
        socketManager.off('players-reordered', handleOffensivePlayerUpdate);
        socketManager.leaveGame();
      };
    }
  }, [game?.id, isAuthenticated, queryClient, gameId, shareCode, user?.id]);

  const addOffender = () => {
    if (newOffenderName.trim() && game) {
      addOffensivePlayerMutation.mutate({
        name: newOffenderName.trim(),
        position: newOffenderPosition,
        isBench: false
      });
    }
  };

  const addDefenderToCurrentPoint = (offensivePlayerId: string, defenderId: string) => {
    setCurrentPoint(prev => {
      const filtered = prev.filter(cp => cp.offensivePlayerId !== offensivePlayerId);
      return [...filtered, { offensivePlayerId, defenderId }];
    });

    if (socketManager.isConnected() && game) {
      socketManager.updatePoint({
        gameId: game.id,
        gotBreak: false,
        matchups: currentPoint
      });
    }
  };

  const removeDefenderFromCurrentPoint = (offensivePlayerId: string) => {
    setCurrentPoint(prev => prev.filter(cp => cp.offensivePlayerId !== offensivePlayerId));
  };

  const clearCurrentPoint = () => {
    clearAllCurrentPointDefenders();
  };

  const savePoint = (gotBreak: boolean) => {
    if (!game) return;

    // Check if any defenders are selected
    if (selectedDefenderIds.length === 0) {
      // Silently prevent saving without selected defenders
      return;
    }

    // Collect matchups from current point defenders (can be empty)
    const matchups = game.offensivePlayers
      ?.filter((p: any) => !p.isBench && p.currentPointDefender)
      .map((p: any) => ({
        offensivePlayerId: p.id,
        defenderId: p.currentPointDefender.defenderId
      })) || [];

    // Update game status to IN_PROGRESS if it's still in SETUP
    if (game.status === 'SETUP') {
      gamesApi.update(game.id, { status: 'IN_PROGRESS' });
    }

    // Include selected defenders in the point data
    createPointMutation.mutate({
      gameId: game.id,
      gotBreak,
      matchups,
      selectedDefenderIds // Pass the selected defenders
    });

    setLastButtonClicked(gotBreak ? 'break' : 'nobreak');
    setTimeout(() => setLastButtonClicked(null), 500);
  };

  const togglePointExpansion = (pointId: string) => {
    setExpandedPoints(prev =>
      prev.includes(pointId)
        ? prev.filter(id => id !== pointId)
        : [...prev, pointId]
    );
  };

  const getPositionColor = (position: string) => {
    switch(position) {
      case 'HANDLER':
      case 'CENTER_HANDLER':
      case 'RESET_HANDLER':
        return 'bg-blue-100 text-blue-800';
      case 'CUTTER':
      case 'INITIATING_CUTTER':
      case 'FILL_CUTTER':
      case 'DEEP_CUTTER':
        return 'bg-green-100 text-green-800';
      case 'FRONT_OF_STACK':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPosition = (position: string) => {
    return position
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Drag and drop handlers with mobile touch support
  const handleDefenderDragStart = (e: React.DragEvent | React.TouchEvent, defender: any) => {
    setDraggedDefender(defender);
    if ('dataTransfer' in e) {
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handlePlayerDragOver = (e: React.DragEvent, playerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPlayer(playerId);
  };

  const handlePlayerDragLeave = () => {
    setDragOverPlayer(null);
  };

  const handleDefenderDrop = (e: React.DragEvent, playerId: string) => {
    e.preventDefault();
    if (draggedDefender) {
      addDefenderToCurrentPoint(playerId, draggedDefender.id);
    }
    setDraggedDefender(null);
    setDragOverPlayer(null);
  };

  const handleDefenderDragEnd = () => {
    setDraggedDefender(null);
    setDragOverPlayer(null);
  };

  // Player drag and drop handlers for swapping
  const handlePlayerDragStart = (e: React.DragEvent, player: any) => {
    setDraggedPlayer(player);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add mouse move listener for auto-scroll
    const handleMouseMove = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    // Store cleanup function
    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      setDragPosition(null);
    };
    
    // Store cleanup on the dragged player for later
    e.dataTransfer.setData('cleanup', 'true');
    (window as any).dragCleanup = cleanup;
    
    startAutoScroll();
  };

  // Auto-scroll functionality
  const startAutoScroll = () => {
    if (autoScrollInterval) return;
    
    const interval = setInterval(() => {
      const scrollSpeed = 10;
      const scrollThreshold = 100;
      
      if (dragPosition) {
        const { y } = dragPosition;
        const windowHeight = window.innerHeight;
        
        if (y < scrollThreshold) {
          window.scrollBy(0, -scrollSpeed);
        } else if (y > windowHeight - scrollThreshold) {
          window.scrollBy(0, scrollSpeed);
        }
      }
    }, 16); // ~60fps
    
    setAutoScrollInterval(interval);
  };

  const stopAutoScroll = () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
  };

  const handlePlayerDragEnd = () => {
    setDraggedPlayer(null);
    setDragOverPlayer(null);
    setDragOverBench(false);
    stopAutoScroll();
    
    // Clean up mouse move listener
    if ((window as any).dragCleanup) {
      (window as any).dragCleanup();
      delete (window as any).dragCleanup;
    }
  };

  const handlePlayerDrop = async (e: React.DragEvent, targetPlayer: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPlayer || draggedPlayer.id === targetPlayer.id) {
      setDraggedPlayer(null);
      setDragOverPlayer(null);
      stopAutoScroll();
      return;
    }
    
    const players = game.offensivePlayers || [];
    
    // Get the target element to check if it's marked as last active
    const targetElement = e.currentTarget as HTMLElement;
    const isTargetLastActive = targetElement.getAttribute('data-last-active') === 'true';
    const isTargetLastBench = targetElement.getAttribute('data-last-bench') === 'true';
    
    // Create new array with proper ordering
    const newPlayers = [...players];
    const draggedIndex = newPlayers.findIndex((p: any) => p.id === draggedPlayer.id);
    const targetIndex = newPlayers.findIndex((p: any) => p.id === targetPlayer.id);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPlayer(null);
      setDragOverPlayer(null);
      stopAutoScroll();
      return;
    }
    
    // Remove the dragged item first
    const [draggedItem] = newPlayers.splice(draggedIndex, 1);
    
    // Update bench status if moving between sections
    const wasOnBench = draggedPlayer.isBench;
    const targetOnBench = targetPlayer.isBench;
    
    if (wasOnBench !== targetOnBench) {
      draggedItem.isBench = targetOnBench;
      // Update bench status in backend
      await updateOffensivePlayerMutation.mutateAsync({
        playerId: draggedItem.id,
        data: { isBench: targetOnBench }
      });
    }
    
    // Calculate insertion index
    let insertIndex;
    
    // Special case: dropping from bench to last active position
    if (isTargetLastActive && wasOnBench && !targetOnBench) {
      // Insert at the end of active section (right before bench)
      const firstBenchIdx = newPlayers.findIndex((p: any) => p.isBench);
      insertIndex = firstBenchIdx !== -1 ? firstBenchIdx : newPlayers.length;
    }
    // Special case: dropping to last bench position
    else if (isTargetLastBench) {
      // Place at the very end
      insertIndex = newPlayers.length;
    }
    // Normal reordering within same section or between sections
    else {
      // Find target's new position after removal
      const newTargetIdx = newPlayers.findIndex((p: any) => p.id === targetPlayer.id);
      if (newTargetIdx !== -1) {
        // If dragging within the same section, we need to consider the direction
        if (draggedIndex < targetIndex) {
          // Dragging from above to below - insert after target
          insertIndex = newTargetIdx + 1;
        } else {
          // Dragging from below to above - insert before target
          insertIndex = newTargetIdx;
        }
      } else {
        // Fallback
        insertIndex = Math.min(targetIndex, newPlayers.length);
      }
    }
    
    // Insert at new position
    newPlayers.splice(insertIndex, 0, draggedItem);
    
    // Call the reorder API with all players to maintain order
    await reorderOffensivePlayersMutation.mutateAsync({
      gameId: game.id,
      playerIds: newPlayers.map((p: any) => p.id)
    });
    
    setDraggedPlayer(null);
    setDragOverPlayer(null);
    stopAutoScroll();
  };

  // Touch event handlers for mobile player swapping
  const handlePlayerTouchStart = (e: React.TouchEvent, player: any) => {
    const touch = e.touches[0];
    const initialPos = { x: touch.clientX, y: touch.clientY };
    
    // Store the row HTML for visual feedback
    const row = e.currentTarget as HTMLTableRowElement;
    const clonedRow = row.cloneNode(true) as HTMLElement;
    clonedRow.style.width = `${row.offsetWidth}px`;
    
    // Store initial touch info in refs to avoid closure issues
    const touchInfo = {
      isScrolling: false,
      isDragActivated: false,
      initialX: touch.clientX,
      initialY: touch.clientY,
      player: player,
      rowHTML: clonedRow.outerHTML
    };
    
    // Start long press timer
    const timeout = setTimeout(() => {
      // Only start drag if not scrolling
      if (!touchInfo.isScrolling) {
        touchInfo.isDragActivated = true;
        setDraggedPlayer(player);
        setDraggedRowHTML(clonedRow.outerHTML);
        setIsDragging(true);
        setDragPosition({ x: touchInfo.initialX, y: touchInfo.initialY });
        // Add haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        // Start auto-scroll interval for continuous scrolling
        startAutoScroll();
      }
    }, 300); // Reduced to 300ms for better responsiveness
    
    // Movement tracking to detect scroll vs drag intent
    const moveHandler = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      const deltaX = Math.abs(moveTouch.clientX - touchInfo.initialX);
      const deltaY = Math.abs(moveTouch.clientY - touchInfo.initialY);
      
      // If vertical movement is greater, it's likely a scroll
      // Only consider it scrolling if drag hasn't been activated yet
      if (!touchInfo.isDragActivated && deltaY > deltaX && deltaY > 5) {
        touchInfo.isScrolling = true;
        clearTimeout(timeout);
        // Don't clean up drag state here - it might not have been set yet
      }
      
      // Update position if drag is active
      if (touchInfo.isDragActivated && !touchInfo.isScrolling) {
        moveEvent.preventDefault(); // Prevent scrolling while dragging
        setDragPosition({ x: moveTouch.clientX, y: moveTouch.clientY });
        
        // Auto-scroll when near edges for mobile
        const scrollSpeed = 8;
        const scrollThreshold = 100;
        const windowHeight = window.innerHeight;
        
        if (moveTouch.clientY < scrollThreshold) {
          // Scroll up
          window.scrollBy(0, -scrollSpeed);
        } else if (moveTouch.clientY > windowHeight - scrollThreshold) {
          // Scroll down  
          window.scrollBy(0, scrollSpeed);
        }
        
        // Find element under finger
        const draggedElement = document.getElementById('dragged-player-clone');
        if (draggedElement) {
          draggedElement.style.pointerEvents = 'none';
        }
        
        const element = document.elementFromPoint(moveTouch.clientX, moveTouch.clientY);
        const playerRow = element?.closest('tr[data-player-id]');
        const benchSeparator = element?.closest('tr[data-bench-separator]');
        
        // Check for bench separator first
        if (benchSeparator) {
          setDragOverBench(true);
          setDragOverPlayer(null);
        } else if (playerRow) {
          const playerId = playerRow.getAttribute('data-player-id');
          if (playerId && playerId !== touchInfo.player.id) {
            setDragOverPlayer(playerId);
            setDragOverBench(false);
          }
        } else {
          setDragOverPlayer(null);
          setDragOverBench(false);
        }
      }
    };
    
    // Clean up on touch end
    const endHandler = async (endEvent: TouchEvent) => {
      clearTimeout(timeout);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', endHandler);
      document.removeEventListener('touchcancel', endHandler);
      
      // Handle drop if drag was active
      if (touchInfo.isDragActivated && !touchInfo.isScrolling) {
        const touch = endEvent.changedTouches?.[0] || endEvent.touches?.[0];
        if (touch) {
          // Find element under finger
          const draggedElement = document.getElementById('dragged-player-clone');
          if (draggedElement) {
            draggedElement.style.display = 'none';
          }
          
          const element = document.elementFromPoint(touch.clientX, touch.clientY);
          let playerRow = element?.closest('tr[data-player-id]');
          const benchSeparator = element?.closest('tr[data-bench-separator]');
          
          // If we're between rows, find the nearest player row
          if (!playerRow && !benchSeparator) {
            // Get all player rows
            const allRows = document.querySelectorAll('tr[data-player-id]');
            let closestRow = null;
            let closestDistance = Infinity;
            
            allRows.forEach((row) => {
              const rect = row.getBoundingClientRect();
              const distance = Math.abs(rect.top + rect.height / 2 - touch.clientY);
              if (distance < closestDistance) {
                closestDistance = distance;
                closestRow = row;
              }
            });
            
            if (closestRow && closestDistance < 50) { // Within 50px of a row
              playerRow = closestRow;
            }
          }
          
          // Handle drop on bench separator
          if (benchSeparator && touchInfo.player) {
            const draggedPlayer = game.offensivePlayers?.find((p: any) => p.id === touchInfo.player.id);
            if (draggedPlayer) {
              const players = game.offensivePlayers || [];
              const newPlayers = [...players];
              const draggedIndex = newPlayers.findIndex((p: any) => p.id === draggedPlayer.id);
              
              if (draggedIndex !== -1) {
                const [draggedItem] = newPlayers.splice(draggedIndex, 1);
                
                // Check if we need to change bench status
                const wasOnBench = draggedItem.isBench;
                draggedItem.isBench = true;
                
                // Find where to insert in bench
                const benchPlayers = newPlayers.filter((p: any) => p.isBench);
                if (benchPlayers.length === 0) {
                  // Empty bench - add at end
                  newPlayers.push(draggedItem);
                } else {
                  // Add at beginning of bench
                  const firstBenchIndex = newPlayers.findIndex((p: any) => p.isBench);
                  newPlayers.splice(firstBenchIndex, 0, draggedItem);
                }
                
                // Update bench status if changed
                if (!wasOnBench) {
                  await updateOffensivePlayerMutation.mutateAsync({
                    playerId: draggedItem.id,
                    data: { isBench: true }
                  });
                }
                
                await reorderOffensivePlayersMutation.mutateAsync({
                  gameId: game.id,
                  playerIds: newPlayers.map((p: any) => p.id)
                });
              }
            }
          } else if (playerRow) {
            const targetPlayerId = playerRow.getAttribute('data-player-id');
            const isLastActive = playerRow.getAttribute('data-last-active') === 'true';
            const isLastBench = playerRow.getAttribute('data-last-bench') === 'true';
            
            if (targetPlayerId && targetPlayerId !== touchInfo.player.id) {
              // Get fresh player data from game state
              const draggedPlayer = game.offensivePlayers?.find((p: any) => p.id === touchInfo.player.id);
              const targetPlayer = game.offensivePlayers?.find((p: any) => p.id === targetPlayerId);
              
              if (draggedPlayer && targetPlayer) {
                // Reorder players (same logic as desktop)
                const players = game.offensivePlayers || [];
                const draggedIndex = players.findIndex((p: any) => p.id === draggedPlayer.id);
                const targetIndex = players.findIndex((p: any) => p.id === targetPlayer.id);
                
                if (draggedIndex !== -1 && targetIndex !== -1) {
                  const newPlayers = [...players];
                  
                  // Remove dragged player from its position
                  const [draggedItem] = newPlayers.splice(draggedIndex, 1);
                  
                  // Update bench status if moving between sections
                  if (draggedPlayer.isBench !== targetPlayer.isBench) {
                    draggedItem.isBench = targetPlayer.isBench;
                    // Update bench status in backend
                    await updateOffensivePlayerMutation.mutateAsync({
                      playerId: draggedItem.id,
                      data: { isBench: targetPlayer.isBench }
                    });
                  }
                  
                  // Calculate insertion index based on the scenario
                  let insertIndex;
                  
                  // Special case: dropping from bench to last active position
                  if (isLastActive && draggedPlayer.isBench && !targetPlayer.isBench) {
                    // We want to place it at the end of active section (right above bench)
                    // Find where bench section starts in the array after removal
                    const firstBenchIdx = newPlayers.findIndex((p: any) => p.isBench);
                    insertIndex = firstBenchIdx !== -1 ? firstBenchIdx : newPlayers.length;
                  } 
                  // Special case: dropping to last bench position
                  else if (isLastBench && !draggedPlayer.isBench && targetPlayer.isBench) {
                    // Place at the very end
                    insertIndex = newPlayers.length;
                  }
                  // Normal reordering within same section
                  else {
                    // Find target's new position after removal
                    const newTargetIdx = newPlayers.findIndex((p: any) => p.id === targetPlayer.id);
                    if (newTargetIdx !== -1) {
                      // If dragging within the same section, we need to consider the direction
                      if (draggedIndex < targetIndex) {
                        // Dragging from above to below - insert after target
                        insertIndex = newTargetIdx + 1;
                      } else {
                        // Dragging from below to above - insert before target
                        insertIndex = newTargetIdx;
                      }
                    } else {
                      // Fallback
                      insertIndex = Math.min(targetIndex, newPlayers.length);
                    }
                  }
                  
                  // Insert at new position
                  newPlayers.splice(insertIndex, 0, draggedItem);
                  
                  try {
                    // Call the reorder API with all players to maintain order
                    await reorderOffensivePlayersMutation.mutateAsync({
                      gameId: game.id,
                      playerIds: newPlayers.map((p: any) => p.id)
                    });
                  } catch (error) {
                    console.error('Error reordering players:', error);
                  }
                }
              }
            }
          }
        }
      }
      
      // Reset all drag states
      setIsDragging(false);
      setDraggedPlayer(null);
      setDragOverPlayer(null);
      setDragOverBench(false);
      setDragPosition(null);
      setDraggedRowHTML('');
      setTouchTimeout(null);
      stopAutoScroll();
    };
    
    // Attach event listeners
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', endHandler);
    document.addEventListener('touchcancel', endHandler);
    
    setTouchTimeout(timeout);
  };

  const handlePlayerTouchMove = (e: React.TouchEvent) => {
    // Touch move is now handled in the touchstart event listener
    // This function can be simplified or removed
    if (!isDragging || !draggedPlayer) return;
    e.preventDefault();
  };

  const handlePlayerTouchEnd = async (e: React.TouchEvent) => {
    // Touch end is now handled in the touchstart event listener
    // This function can be simplified
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
    // Ensure auto-scroll is stopped
    stopAutoScroll();
  };

  // Handler functions for Potential Matchups and Current Point
  const handleAddAvailableDefender = async (playerId: string, defenderId: string) => {
    if (!game) return;
    
    try {
      await gamesApi.addAvailableDefender(game.id, playerId, defenderId);
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
    } catch (error) {
      console.error('Error adding available defender:', error);
    }
  };

  const handleRemoveAvailableDefender = async (playerId: string, defenderId: string) => {
    if (!game) return;
    
    try {
      await gamesApi.removeAvailableDefender(game.id, playerId, defenderId);
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      
      // Also remove from current point if selected
      const player = game.offensivePlayers?.find((p: any) => p.id === playerId);
      if (player?.currentPointDefender?.defenderId === defenderId) {
        await handleRemoveCurrentPointDefender(playerId);
      }
    } catch (error) {
      console.error('Error removing available defender:', error);
    }
  };

  const handleSetCurrentPointDefender = async (playerId: string, defenderId: string) => {
    if (!game) return;
    
    // Check if defender is selected in Call Your Line
    if (!selectedDefenderIds.includes(defenderId)) {
      // Silently prevent assignment if not selected
      return;
    }
    
    try {
      // First check if this defender is already assigned to another player
      const otherPlayer = game.offensivePlayers?.find((p: any) => 
        p.id !== playerId && p.currentPointDefender?.defenderId === defenderId
      );
      
      if (otherPlayer) {
        // Remove from other player first
        await gamesApi.setCurrentPointDefender(game.id, otherPlayer.id, null);
      }
      
      await gamesApi.setCurrentPointDefender(game.id, playerId, defenderId);
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      setUnsavedChanges(true);
      
      // Start point timer if not started
      if (!pointStartTime) {
        setPointStartTime(new Date());
      }
    } catch (error) {
      console.error('Error setting current point defender:', error);
    }
  };

  const handleRemoveCurrentPointDefender = async (playerId: string) => {
    if (!game) return;
    
    try {
      await gamesApi.setCurrentPointDefender(game.id, playerId, null);
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      setUnsavedChanges(true);
    } catch (error) {
      console.error('Error removing current point defender:', error);
    }
  };

  const clearAllCurrentPointDefenders = async () => {
    if (!game) return;
    
    try {
      await gamesApi.clearCurrentPointDefenders(game.id);
      queryClient.invalidateQueries({ queryKey: ['game', gameId || shareCode] });
      setUnsavedChanges(false);
      setPointStartTime(null);
      setElapsedTime(0);
    } catch (error) {
      console.error('Error clearing current point defenders:', error);
    }
  };

  const handleEditPlayerName = (player: any) => {
    setEditingPlayerId(player.id);
    setEditingPlayerName(player.name);
  };

  const handleSavePlayerName = async () => {
    if (!game || !editingPlayerId || !editingPlayerName.trim()) return;
    
    try {
      await updateOffensivePlayerMutation.mutateAsync({
        playerId: editingPlayerId,
        data: { name: editingPlayerName.trim() }
      });
      setEditingPlayerId(null);
      setEditingPlayerName('');
    } catch (error) {
      console.error('Error updating player name:', error);
    }
  };

  const handleCancelEditPlayerName = () => {
    setEditingPlayerId(null);
    setEditingPlayerName('');
  };

  const exportGameData = async (format: 'json' | 'csv') => {
    if (!game) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/export/game/${game.id}/${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game-${game.slug}-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Use sortable data for offensive players
  const activePlayers = game?.offensivePlayers?.filter((p: any) => !p.isBench) || [];
  const { sortedData: sortedActivePlayers, sortConfig, handleSort } = useSortableData(
    activePlayers,
    'order',
    'asc'
  );

  const getPlayingTimeStats = () => {
    const stats: any = {};
    
    // Use defenders from the team or from the local defenders list
    const allDefenders = defenders || game?.team?.defenders || [];
    if (allDefenders.length === 0 || !game?.points) return [];

    allDefenders.forEach((defender: any) => {
      stats[defender.id] = {
        id: defender.id,
        name: defender.name,
        jerseyNumber: defender.jerseyNumber,
        pointsPlayed: 0,
        breaks: 0,
        noBreaks: 0,
        matchupsWon: 0,
        playingTime: 0
      };
    });

    game.points.forEach((point: any) => {
      point.matchups?.forEach((matchup: any) => {
        if (matchup.defender && stats[matchup.defender.id]) {
          stats[matchup.defender.id].pointsPlayed++;
          if (point.gotBreak) {
            stats[matchup.defender.id].breaks++;
          } else {
            stats[matchup.defender.id].noBreaks++;
          }
          // Track playing time if available
          if (point.completedAt && point.startedAt) {
            const duration = new Date(point.completedAt).getTime() - new Date(point.startedAt).getTime();
            stats[matchup.defender.id].playingTime += duration;
          }
        }
      });
    });

    return Object.values(stats).sort((a: any, b: any) => b.pointsPlayed - a.pointsPlayed);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Game not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Floating dragged player row for mobile */}
      {isDragging && draggedPlayer && dragPosition && (
        <div
          id="dragged-player-clone"
          className="fixed z-50 pointer-events-none"
          style={{
            left: dragPosition.x - 100,
            top: dragPosition.y - 30,
            opacity: 0.9
          }}
        >
          <table className="bg-white shadow-2xl rounded-lg border-2 border-blue-500">
            <tbody dangerouslySetInnerHTML={{ __html: draggedRowHTML }} />
          </table>
        </div>
      )}
      
      <div className="bg-gray-800 text-white">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            {!isPublic && (
              <div className="flex flex-wrap items-center gap-1">
                {game?.status !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      if (confirm('Mark this game as complete? This will finalize all statistics.')) {
                        updateGameStatusMutation.mutate('COMPLETED');
                      }
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span>Complete game</span>
                  </button>
                )}
                <button
                  onClick={clearCurrentPoint}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium"
                >
                  Clear
                </button>
                <div className="relative group">
                  <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center">
                    <Download className="h-3 w-3" />
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                    {game?.isPublic && (
                      <button
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/public/game/${game.shareCode}`;
                          navigator.clipboard.writeText(shareUrl);
                          alert('Share link copied!');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Share Link
                      </button>
                    )}
                    <button
                      onClick={() => exportGameData('json')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={() => exportGameData('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as CSV
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold truncate">{game.name}</h1>
              {game.status === 'COMPLETED' && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                  Completed
                </span>
              )}
              {game.status === 'IN_PROGRESS' && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                  In Progress
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {isPublic ? 'View-only mode' : game.status === 'COMPLETED' ? 'Game finalized' : 'Auto-saving changes'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Point Control Section */}
        {!isPublic && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-700 text-white px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium">Current Point</h2>
                <div className="flex items-center space-x-3">
                  {(() => {
                    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                    return settings?.gameDefaults?.showTimer && pointStartTime ? (
                      <div className="flex items-center text-sm text-gray-200">
                        <Clock className="h-4 w-4 mr-1" />
                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                      </div>
                    ) : null;
                  })()}
                  {unsavedChanges && (
                    <div className="flex items-center text-sm text-yellow-300">
                      <Save className="h-4 w-4 mr-1" />
                      Unsaved
                    </div>
                  )}
                  <div className="px-3 py-1 rounded-md text-white text-sm font-medium" style={{ backgroundColor: '#3E8EDE' }}>
                    Point #{(game.points?.length || 0) + 1}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => savePoint(true)}
                  disabled={selectedDefenderIds.length === 0}
                  className={`flex-1 px-4 py-2 text-white rounded-md font-medium text-sm transition-all disabled:opacity-50 ${
                    lastButtonClicked === 'break' 
                      ? 'bg-emerald-800 scale-95' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Break ✓
                </button>
                <button
                  onClick={() => savePoint(false)}
                  disabled={selectedDefenderIds.length === 0}
                  className={`flex-1 px-4 py-2 text-white rounded-md font-medium text-sm transition-all disabled:opacity-50 ${
                    lastButtonClicked === 'nobreak' 
                      ? 'bg-rose-800 scale-95' 
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  No Break ✗
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Call Your Line Section */}
        {!isPublic && game && (
          <CallYourLine
            gameId={game.id}
            teamId={game.teamId}
            defenders={defenders}
            offensivePlayers={game.offensivePlayers || []}
            isPublic={isPublic}
            onSelectionChange={setSelectedDefenderIds}
          />
        )}

        {/* Matchups Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-medium text-gray-800">Matchups</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableTableHeader
                    label="Offensive Player"
                    sortKey="name"
                    currentSortKey={sortConfig.key}
                    sortDirection={sortConfig.direction}
                    onSort={handleSort}
                    className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  />
                  <SortableTableHeader
                    label="Position"
                    sortKey="position"
                    currentSortKey={sortConfig.key}
                    sortDirection={sortConfig.direction}
                    onSort={handleSort}
                    className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  />
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential Matchups</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Point</th>
                  {!isPublic && (
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delete</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedActivePlayers.map((player: any, index: number) => {
                  const currentDefender = currentPoint.find(cp => cp.offensivePlayerId === player.id);
                  const isLastActive = index === sortedActivePlayers.length - 1;
                  const showBottomBorder = isLastActive && dragOverPlayer === player.id && draggedPlayer && draggedPlayer.id !== player.id && draggedPlayer.isBench;
                  
                  return (
                    <tr 
                      key={player.id}
                      data-player-id={player.id}
                      data-last-active={isLastActive}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${!isPublic ? 'cursor-move hover:bg-gray-100' : ''} transition-all ${
                        isDragging && draggedPlayer?.id === player.id ? 'opacity-50' : ''
                      }`}
                      style={{
                        borderTop: dragOverPlayer === player.id && draggedPlayer && draggedPlayer.id !== player.id && !showBottomBorder ? '3px solid #3E8EDE' : undefined,
                        borderBottom: showBottomBorder ? '3px solid #3E8EDE' : undefined,
                        touchAction: isDragging ? 'none' : 'auto',
                        userSelect: isDragging ? 'none' : 'auto',
                        WebkitUserSelect: isDragging ? 'none' : 'auto'
                      }}
                      draggable={!isPublic}
                      onDragStart={(e) => handlePlayerDragStart(e, player)}
                      onDragEnd={handlePlayerDragEnd}
                      onDragOver={(e) => handlePlayerDragOver(e, player.id)}
                      onDrop={(e) => handlePlayerDrop(e, player)}
                      onDragEnter={(e) => {
                        if (draggedPlayer && draggedPlayer.id !== player.id) {
                          setDragOverPlayer(player.id);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget === e.target) setDragOverPlayer(null);
                      }}
                      onTouchStart={(e) => !isPublic && handlePlayerTouchStart(e, player)}
                      onTouchMove={(e) => !isPublic && handlePlayerTouchMove(e)}
                      onTouchEnd={(e) => !isPublic && handlePlayerTouchEnd(e)}
                    >
                      <td className="px-2 sm:px-4 py-3">
                        {editingPlayerId === player.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingPlayerName}
                              onChange={(e) => setEditingPlayerName(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') handleSavePlayerName();
                                if (e.key === 'Escape') handleCancelEditPlayerName();
                              }}
                              className="px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={handleSavePlayerName}
                              className="p-1 text-green-600 hover:text-green-800"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancelEditPlayerName}
                              className="p-1 text-red-600 hover:text-red-800"
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <span 
                            className="font-medium text-sm leading-[0.9rem] block text-gray-900 cursor-pointer hover:text-blue-600"
                            onClick={() => !isPublic && handleEditPlayerName(player)}
                          >
                            {player.name}
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        {!isPublic ? (
                          <select
                            value={player.position}
                            onChange={(e) => updateOffensivePlayerMutation.mutate({
                              playerId: player.id,
                              data: { position: e.target.value }
                            })}
                            className={`px-2 py-1 text-xs font-medium rounded-full border-0 focus:outline-none w-full max-w-32 ${
                              getPositionColor(player.position)
                            }`}
                          >
                            {offensivePositions.map(pos => (
                              <option key={pos} value={pos}>{formatPosition(pos)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPositionColor(player.position)}`}>
                            {formatPosition(player.position)}
                          </span>
                        )}
                      </td>
                      {/* Potential Matchups Column */}
                      <td className="px-2 sm:px-4 py-3">
                        <div className="min-h-10 p-2 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                          <div className="flex flex-wrap gap-1 items-center">
                            {player.availableDefenders?.map((ad: any) => {
                              // Check if this defender is in ANY player's current point
                              const isInAnyCurrentPoint = game.offensivePlayers?.some((p: any) => 
                                p.currentPointDefender?.defenderId === ad.defender.id
                              );
                              // Check if defender is selected in Call Your Line
                              const isSelected = selectedDefenderIds.includes(ad.defender.id);
                              
                              return (
                                <div 
                                  key={ad.id}
                                  className={`px-2 py-1 rounded-md text-xs flex items-center space-x-1 ${
                                    isInAnyCurrentPoint && !isSelected ? 'opacity-50' : ''
                                  } text-white`}
                                  style={{ 
                                    backgroundColor: isSelected || isInAnyCurrentPoint ? '#3E8EDE' : '#93C5FD',
                                    opacity: isSelected && !isInAnyCurrentPoint ? 1 : isInAnyCurrentPoint ? 0.6 : 0.5
                                  }}
                                >
                                  <span>{ad.defender.name}</span>
                                  {!isPublic && (
                                    <button
                                      onClick={() => handleRemoveAvailableDefender(player.id, ad.defender.id)}
                                      className="text-white opacity-75 hover:opacity-100"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {!isPublic && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddAvailableDefender(player.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="text-xs px-1 py-1 border rounded min-w-12"
                                defaultValue=""
                              >
                                <option value="">+ Add</option>
                                {defenders.filter((d: any) => 
                                  !player.availableDefenders?.some((ad: any) => ad.defender.id === d.id)
                                ).map((defender: any) => (
                                  <option key={defender.id} value={defender.id}>{defender.name}</option>
                                ))}
                              </select>
                            )}
                            {(!player.availableDefenders || player.availableDefenders.length === 0) && !isPublic && (
                              <span className="text-gray-400 text-xs">Add defenders</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Current Point Column */}
                      <td className="px-2 sm:px-4 py-3">
                        <div className="min-h-10 p-2 border-2 border-dashed border-emerald-300 rounded-lg bg-emerald-50">
                          <div className="flex flex-wrap gap-1 items-center">
                            {player.currentPointDefender && (
                              <div 
                                className="bg-emerald-600 text-white px-2 py-1 rounded-md text-xs flex items-center justify-between"
                              >
                                <span>{player.currentPointDefender.defender.name}</span>
                                {!isPublic && (
                                  <button
                                    onClick={() => handleRemoveCurrentPointDefender(player.id)}
                                    className="text-emerald-200 hover:text-white ml-1"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            )}
                            {!isPublic && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSetCurrentPointDefender(player.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="text-xs px-1 py-1 border rounded min-w-12"
                                defaultValue=""
                              >
                                <option value="">{player.currentPointDefender ? '↻ Replace' : '+ Select'}</option>
                                {player.availableDefenders
                                  ?.filter((ad: any) => selectedDefenderIds.includes(ad.defender.id))
                                  .map((ad: any) => (
                                    <option key={ad.defender.id} value={ad.defender.id}>
                                      {ad.defender.name}
                                    </option>
                                  ))}
                              </select>
                            )}
                            {!player.currentPointDefender && !player.availableDefenders?.length && !isPublic && (
                              <span className="text-gray-400 text-xs">Add defenders first</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {!isPublic && (
                        <td className="px-2 sm:px-4 py-3">
                          <button
                            onClick={() => deleteOffensivePlayerMutation.mutate(player.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                
                {/* Bench separator - always visible */}
                <tr
                  id="bench-separator"
                  data-bench-separator="true"
                  className={`transition-all ${
                    dragOverBench && draggedPlayer && !draggedPlayer.isBench && game.offensivePlayers?.filter((p: any) => p.isBench).length === 0 
                      ? 'bg-blue-100 ring-2 ring-blue-400' 
                      : ''
                  }`}
                  style={{
                    borderBottom: dragOverBench && draggedPlayer && !draggedPlayer.isBench && game.offensivePlayers?.filter((p: any) => p.isBench).length > 0 ? '3px solid #3E8EDE' : undefined
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedPlayer) {
                      setDragOverBench(true);
                    }
                  }}
                  onDragLeave={() => setDragOverBench(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (draggedPlayer) {
                      const players = game.offensivePlayers || [];
                      const newPlayers = [...players];
                      const draggedIndex = newPlayers.findIndex((p: any) => p.id === draggedPlayer.id);
                      
                      if (draggedIndex !== -1) {
                        // Remove from current position
                        const [draggedItem] = newPlayers.splice(draggedIndex, 1);
                        
                        // Update to bench status
                        draggedItem.isBench = true;
                        
                        // Find where to insert in bench (at the beginning of bench section)
                        const firstBenchIndex = newPlayers.findIndex((p: any) => p.isBench);
                        if (firstBenchIndex !== -1) {
                          // Insert at beginning of bench
                          newPlayers.splice(firstBenchIndex, 0, draggedItem);
                        } else {
                          // No bench players, add at end
                          newPlayers.push(draggedItem);
                        }
                        
                        // Update bench status
                        await updateOffensivePlayerMutation.mutateAsync({
                          playerId: draggedItem.id,
                          data: { isBench: true }
                        });
                        
                        // Reorder all players
                        await reorderOffensivePlayersMutation.mutateAsync({
                          gameId: game.id,
                          playerIds: newPlayers.map((p: any) => p.id)
                        });
                      }
                    }
                    setDragOverBench(false);
                    setDraggedPlayer(null);
                    stopAutoScroll();
                  }}
                >
                  <td colSpan={isPublic ? 4 : 5} className={`px-4 text-center bg-gray-100 ${
                    game.offensivePlayers?.filter((p: any) => p.isBench).length === 0 ? 'py-8' : 'py-2'
                  }`}>
                    <span className="text-sm font-semibold text-gray-600 uppercase">
                      {game.offensivePlayers?.filter((p: any) => p.isBench).length === 0 && dragOverBench && !draggedPlayer?.isBench
                        ? '↓ Drop Here to Add to Bench ↓' 
                        : '— Bench —'}
                    </span>
                  </td>
                </tr>
                
                {/* Bench players */}
                {game.offensivePlayers?.filter((p: any) => p.isBench).map((player: any, index: number, benchArray: any[]) => {
                  const isLastBench = index === benchArray.length - 1;
                  const showBottomBorder = isLastBench && dragOverPlayer === player.id && draggedPlayer && draggedPlayer.id !== player.id && !draggedPlayer.isBench;
                  
                  return (
                  <tr 
                    key={player.id}
                    data-player-id={player.id}
                    data-last-bench={isLastBench}
                    className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${!isPublic ? 'cursor-move hover:bg-gray-100' : ''} transition-all ${
                      isDragging && draggedPlayer?.id === player.id ? 'opacity-50' : ''
                    }`}
                    style={{
                      borderTop: dragOverPlayer === player.id && draggedPlayer && draggedPlayer.id !== player.id && !showBottomBorder ? '3px solid #3E8EDE' : undefined,
                      borderBottom: showBottomBorder ? '3px solid #3E8EDE' : undefined,
                      touchAction: isDragging ? 'none' : 'auto',
                      userSelect: isDragging ? 'none' : 'auto',
                      WebkitUserSelect: isDragging ? 'none' : 'auto'
                    }}
                    draggable={!isPublic}
                    onDragStart={(e) => handlePlayerDragStart(e, player)}
                    onDragEnd={handlePlayerDragEnd}
                    onDragOver={(e) => handlePlayerDragOver(e, player.id)}
                    onDrop={(e) => handlePlayerDrop(e, player)}
                    onDragEnter={(e) => {
                      if (draggedPlayer && draggedPlayer.id !== player.id) {
                        setDragOverPlayer(player.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget === e.target) setDragOverPlayer(null);
                    }}
                    onTouchStart={(e) => !isPublic && handlePlayerTouchStart(e, player)}
                    onTouchMove={(e) => !isPublic && handlePlayerTouchMove(e)}
                    onTouchEnd={(e) => !isPublic && handlePlayerTouchEnd(e)}
                  >
                    <td className="px-2 sm:px-4 py-3">
                      <span className="font-medium text-sm leading-[0.9rem] block text-gray-900">{player.name}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      {!isPublic ? (
                        <select
                          value={player.position}
                          onChange={(e) => updateOffensivePlayerMutation.mutate({
                            playerId: player.id,
                            data: { position: e.target.value }
                          })}
                          className={`px-2 py-1 text-xs font-medium rounded-full border-0 focus:outline-none w-full max-w-32 ${
                            getPositionColor(player.position)
                          }`}
                        >
                          {offensivePositions.map(pos => (
                            <option key={pos} value={pos}>{formatPosition(pos)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPositionColor(player.position)}`}>
                          {formatPosition(player.position)}
                        </span>
                      )}
                    </td>
                    {/* Potential Matchups Column for Bench */}
                    <td className="px-2 sm:px-4 py-3">
                      <div className="min-h-10 p-2 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                        <div className="flex flex-wrap gap-1 items-center">
                          {player.availableDefenders?.map((ad: any) => {
                            // Check if this defender is in ANY player's current point
                            const isInAnyCurrentPoint = game.offensivePlayers?.some((p: any) => 
                              p.currentPointDefender?.defenderId === ad.defender.id
                            );
                            // Check if defender is selected in Call Your Line
                            const isSelected = selectedDefenderIds.includes(ad.defender.id);
                            
                            return (
                              <div 
                                key={ad.id}
                                className={`px-2 py-1 rounded-md text-xs flex items-center space-x-1 ${
                                  isInAnyCurrentPoint && !isSelected ? 'opacity-50' : ''
                                } text-white`}
                                style={{ 
                                  backgroundColor: isSelected || isInAnyCurrentPoint ? '#3E8EDE' : '#93C5FD',
                                  opacity: isSelected && !isInAnyCurrentPoint ? 1 : isInAnyCurrentPoint ? 0.6 : 0.5
                                }}
                              >
                                <span>{ad.defender.name}</span>
                                {!isPublic && (
                                  <button
                                    onClick={() => handleRemoveAvailableDefender(player.id, ad.defender.id)}
                                    className="text-white opacity-75 hover:opacity-100"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {!isPublic && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddAvailableDefender(player.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="text-xs px-1 py-1 border rounded min-w-12"
                              defaultValue=""
                            >
                              <option value="">+ Add</option>
                              {defenders.filter((d: any) => 
                                !player.availableDefenders?.some((ad: any) => ad.defender.id === d.id)
                              ).map((defender: any) => (
                                <option key={defender.id} value={defender.id}>{defender.name}</option>
                              ))}
                            </select>
                          )}
                          {(!player.availableDefenders || player.availableDefenders.length === 0) && !isPublic && (
                            <span className="text-gray-400 text-xs">Add defenders</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Current Point Column for Bench */}
                    <td className="px-2 sm:px-4 py-3">
                      <div className="min-h-10 p-2 border-2 border-dashed border-emerald-300 rounded-lg bg-emerald-50">
                        <div className="flex flex-wrap gap-1 items-center">
                          {player.currentPointDefender && (
                            <div 
                              className="bg-emerald-600 text-white px-2 py-1 rounded-md text-xs flex items-center justify-between"
                            >
                              <span>{player.currentPointDefender.defender.name}</span>
                              {!isPublic && (
                                <button
                                  onClick={() => handleRemoveCurrentPointDefender(player.id)}
                                  className="text-emerald-200 hover:text-white ml-1"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}
                          {!isPublic && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleSetCurrentPointDefender(player.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="text-xs px-1 py-1 border rounded min-w-12"
                              defaultValue=""
                            >
                              <option value="">{player.currentPointDefender ? '↻ Replace' : '+ Select'}</option>
                              {player.availableDefenders
                                ?.filter((ad: any) => selectedDefenderIds.includes(ad.defender.id))
                                .map((ad: any) => (
                                  <option key={ad.defender.id} value={ad.defender.id}>
                                    {ad.defender.name}
                                  </option>
                                ))}
                            </select>
                          )}
                          {!player.currentPointDefender && !player.availableDefenders?.length && !isPublic && (
                            <span className="text-gray-400 text-xs">Add defenders first</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {!isPublic && (
                      <td className="px-2 sm:px-4 py-3">
                        <button
                          onClick={() => deleteOffensivePlayerMutation.mutate(player.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Offensive Players */}
        {!isPublic && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium mb-4 text-gray-800">Add Offensive Player</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newOffenderName}
                onChange={(e) => setNewOffenderName(e.target.value)}
                placeholder="Offensive player name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onKeyPress={(e) => e.key === 'Enter' && addOffender()}
              />
              <select
                value={newOffenderPosition}
                onChange={(e) => setNewOffenderPosition(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              >
                {offensivePositions.map(pos => (
                  <option key={pos} value={pos}>{formatPosition(pos)}</option>
                ))}
              </select>
              <button
                onClick={addOffender}
                disabled={!newOffenderName.trim()}
                className="w-full px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90 text-base"
                style={{ backgroundColor: '#3E8EDE' }}
              >
                <Plus className="h-5 w-5 mr-2 inline" />
                Add Player
              </button>
            </div>
          </div>
        )}

        {/* Player Statistics Table */}
        {defenders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-800 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Player Statistics
              </h2>
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {game.points?.length || 0} total points
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Breaks</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">No Breaks</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Break %</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Playing %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getPlayingTimeStats().length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                        No statistics yet. Save points to track player performance.
                      </td>
                    </tr>
                  ) : (
                    getPlayingTimeStats().map((player: any, index: number) => {
                      const totalPoints = game.points?.length || 1;
                      const playingPercentage = Math.round((player.pointsPlayed / totalPoints) * 100);
                      
                      return (
                        <tr key={player.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium text-gray-900">{player.name}</td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {player.jerseyNumber || '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white" 
                                  style={{ backgroundColor: '#3E8EDE' }}>
                              {player.pointsPlayed}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              {player.breaks}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                              {player.noBreaks}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              player.pointsPlayed === 0 
                                ? 'bg-gray-100 text-gray-800'
                                : (player.breaks / player.pointsPlayed) >= 0.5 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-amber-100 text-amber-800'
                            }`}>
                              {player.pointsPlayed === 0 ? '-' : `${Math.round((player.breaks / player.pointsPlayed) * 100)}%`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${playingPercentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">{playingPercentage}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Point History */}
        {game.points && game.points.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium mb-4 text-gray-800">Point History ({game.points.length})</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {[...game.points].reverse().map((point: any, index: number) => {
                const isExpanded = expandedPoints.includes(point.id);
                const pointNumber = game.points.length - index;
                return (
                  <div key={point.id} className={`rounded-lg border-l-4 ${
                    point.gotBreak ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-rose-500'
                  }`}>
                    <div 
                      className="p-3 cursor-pointer hover:bg-opacity-80"
                      onClick={() => togglePointExpansion(point.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400 text-sm">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            point.gotBreak 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-rose-500 text-white'
                          }`}>
                            {point.gotBreak ? 'BREAK' : 'NO BREAK'}
                          </span>
                          <span className="text-xs text-gray-600">
                            Point #{pointNumber}
                          </span>
                        </div>
                        {!isPublic && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePointMutation.mutate(point.id);
                            }}
                            className="p-1 text-red-600 hover:text-red-800 rounded"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {/* Display selected defenders */}
                        {point.selectedDefenderIds && point.selectedDefenderIds.length > 0 && (
                          <div className="mb-3 p-2 bg-gray-50 rounded">
                            <div className="text-xs text-gray-600 mb-1">Defenders on field:</div>
                            <div className="text-sm text-gray-800">
                              {point.selectedDefenderIds.map((defenderId: string) => {
                                const defender = defenders.find((d: any) => d.id === defenderId);
                                return defender?.name || 'Unknown';
                              }).join(', ')}
                            </div>
                          </div>
                        )}
                        
                        {/* Display matchups */}
                        {point.matchups && point.matchups.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs text-gray-600 mb-1">Matchups:</div>
                            {point.matchups.map((matchup: any, idx: number) => (
                              <div key={idx} className="text-sm bg-white rounded p-2 border flex items-center justify-between">
                                <span className="font-medium text-gray-800">
                                  {matchup.offensivePlayer?.name || 'Unknown'}
                                </span>
                                <span className="text-gray-600">vs</span>
                                <span className="font-medium text-gray-800">
                                  {matchup.defender?.name || 'Unassigned'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}