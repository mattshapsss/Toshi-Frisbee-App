import { Router } from 'express';
import { prisma } from '../server';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { Parser } from 'json2csv';

const router = Router();

// Export game data as JSON
router.get('/game/:gameId/json', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      include: {
        team: {
          include: {
            defenders: true,
            members: {
              include: {
                user: true
              }
            }
          }
        },
        offensivePlayers: true,
        points: {
          include: {
            matchups: {
              include: {
                offensivePlayer: true,
                defender: true
              }
            }
          }
        },
        createdBy: true
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user has access to this game
    const isMember = await prisma.teamMember.findFirst({
      where: {
        teamId: game.teamId,
        userId: req.user!.id
      }
    });

    if (!isMember && !game.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate statistics
    const stats = {
      totalPoints: game.points.length,
      breaks: game.points.filter(p => p.gotBreak).length,
      noBreaks: game.points.filter(p => !p.gotBreak).length,
      breakPercentage: game.points.length > 0 
        ? Math.round((game.points.filter(p => p.gotBreak).length / game.points.length) * 100)
        : 0,
      defenderStats: {} as any
    };

    // Calculate defender statistics
    game.team?.defenders.forEach(defender => {
      stats.defenderStats[defender.id] = {
        name: defender.name,
        pointsPlayed: 0,
        breaks: 0,
        noBreaks: 0
      };
    });

    game.points.forEach(point => {
      point.matchups.forEach(matchup => {
        if (matchup.defenderId && stats.defenderStats[matchup.defenderId]) {
          stats.defenderStats[matchup.defenderId].pointsPlayed++;
          if (point.gotBreak) {
            stats.defenderStats[matchup.defenderId].breaks++;
          } else {
            stats.defenderStats[matchup.defenderId].noBreaks++;
          }
        }
      });
    });

    const exportData = {
      game: {
        id: game.id,
        name: game.name,
        opponent: game.opponent,
        location: game.location,
        date: game.gameDate,
        status: game.status
      },
      team: {
        name: game.team?.name,
        defenders: game.team?.defenders.map(d => ({
          name: d.name,
          position: d.position
        }))
      },
      offensivePlayers: game.offensivePlayers.map(p => ({
        name: p.name,
        position: p.position,
        jerseyNumber: p.jerseyNumber  // Offensive players still have jersey numbers
      })),
      points: game.points.map(p => ({
        number: p.pointNumber,
        gotBreak: p.gotBreak,
        windSpeed: p.windSpeed,
        windDirection: p.windDirection,
        notes: p.notes,
        matchups: p.matchups.map(m => ({
          offensivePlayer: m.offensivePlayer?.name,
          defender: m.defender?.name,
          result: m.result,
          notes: m.notes
        }))
      })),
      statistics: stats,
      exportedAt: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="game-${game.slug}-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

// Export game data as CSV
router.get('/game/:gameId/csv', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      include: {
        team: true,
        points: {
          include: {
            matchups: {
              include: {
                offensivePlayer: true,
                defender: true
              }
            }
          }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check access
    const isMember = await prisma.teamMember.findFirst({
      where: {
        teamId: game.teamId,
        userId: req.user!.id
      }
    });

    if (!isMember && !game.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Flatten data for CSV
    const csvData: any[] = [];
    
    game.points.forEach(point => {
      point.matchups.forEach(matchup => {
        csvData.push({
          'Game': game.name,
          'Opponent': game.opponent || '',
          'Location': game.location || '',
          'Date': game.gameDate?.toISOString() || '',
          'Point #': point.pointNumber,
          'Got Break': point.gotBreak ? 'Yes' : 'No',
          'Wind Speed': point.windSpeed || '',
          'Wind Direction': point.windDirection || '',
          'Offensive Player': matchup.offensivePlayer?.name || '',
          'Position': matchup.offensivePlayer?.position || '',
          'Defender': matchup.defender?.name || '',
          'Result': matchup.result || '',
          'Notes': matchup.notes || ''
        });
      });
    });

    if (csvData.length === 0) {
      // If no points, create a summary row
      csvData.push({
        'Game': game.name,
        'Opponent': game.opponent || '',
        'Location': game.location || '',
        'Date': game.gameDate?.toISOString() || '',
        'Point #': 0,
        'Got Break': '',
        'Wind Speed': '',
        'Wind Direction': '',
        'Offensive Player': 'No points recorded',
        'Position': '',
        'Defender': '',
        'Result': '',
        'Notes': ''
      });
    }

    const parser = new Parser();
    const csv = parser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="game-${game.slug}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export team roster as CSV
router.get('/team/:teamId/roster/csv', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        defenders: true
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check access
    const isMember = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        userId: req.user!.id
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const csvData = team.defenders.map(defender => ({
      'Name': defender.name,
      'Position': defender.position || 'HYBRID',
      'Active': defender.active ? 'Yes' : 'No',
      'Notes': defender.notes || ''
    }));

    const parser = new Parser();
    const csv = parser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="roster-${team.slug}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export all team statistics as JSON
router.get('/team/:teamId/stats', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        defenders: true,
        games: {
          include: {
            points: {
              include: {
                matchups: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check access
    const isMember = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        userId: req.user!.id
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate comprehensive team statistics
    const defenderStats: any = {};
    
    team.defenders.forEach(defender => {
      defenderStats[defender.id] = {
        id: defender.id,
        name: defender.name,
        position: defender.position,
        totalGames: 0,
        totalPoints: 0,
        totalBreaks: 0,
        breakPercentage: 0,
        gamesPlayed: new Set()
      };
    });

    team.games.forEach(game => {
      game.points.forEach(point => {
        point.matchups.forEach(matchup => {
          if (matchup.defenderId && defenderStats[matchup.defenderId]) {
            defenderStats[matchup.defenderId].totalPoints++;
            defenderStats[matchup.defenderId].gamesPlayed.add(game.id);
            if (point.gotBreak) {
              defenderStats[matchup.defenderId].totalBreaks++;
            }
          }
        });
      });
    });

    // Calculate percentages and convert Sets to counts
    Object.values(defenderStats).forEach((stat: any) => {
      stat.totalGames = stat.gamesPlayed.size;
      delete stat.gamesPlayed;
      stat.breakPercentage = stat.totalPoints > 0 
        ? Math.round((stat.totalBreaks / stat.totalPoints) * 100)
        : 0;
    });

    const teamStats = {
      team: {
        name: team.name,
        totalGames: team.games.length,
        totalDefenders: team.defenders.length
      },
      gameStats: {
        totalPoints: team.games.reduce((sum, g) => sum + g.points.length, 0),
        totalBreaks: team.games.reduce((sum, g) => 
          sum + g.points.filter(p => p.gotBreak).length, 0
        ),
        averagePointsPerGame: team.games.length > 0 
          ? Math.round(team.games.reduce((sum, g) => sum + g.points.length, 0) / team.games.length)
          : 0
      },
      defenderStats: Object.values(defenderStats).sort((a: any, b: any) => 
        b.totalPoints - a.totalPoints
      ),
      exportedAt: new Date().toISOString()
    };

    res.json(teamStats);
  } catch (error) {
    next(error);
  }
});

export default router;