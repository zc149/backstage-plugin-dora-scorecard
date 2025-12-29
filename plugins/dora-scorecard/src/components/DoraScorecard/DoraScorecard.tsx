import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, Grid, Typography, LinearProgress, Chip,
  Box, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import SettingsIcon from '@material-ui/icons/Settings';
import { doraMetricsApiRef } from '../../api/DoraMetricsClient';
import { DoraResponse } from '../../types';

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------
const useStyles = makeStyles((theme) => ({
  root: { height: '97.5%', display: 'flex', flexDirection: 'column' },
  content: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  metricCard: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: theme.spacing(2), position: 'relative', overflow: 'hidden' },
  metricValue: { fontSize: '2rem', fontWeight: 700, margin: theme.spacing(1, 0), zIndex: 2, position: 'relative' },
  progressBar: { marginTop: theme.spacing(1), height: 6, borderRadius: 3, zIndex: 2, position: 'relative' },
  chartContainer: { height: 40, marginTop: -10, marginBottom: 10, opacity: 0.8 }
}));

// -------------------------------------------------------------------
// Sparkline Component
// -------------------------------------------------------------------
const SimpleSparkline = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length === 0) {
    return <Box display="flex" alignItems="center" justifyContent="center" height="100%" color="text.disabled"><Typography variant="caption">No Data</Typography></Box>;
  }
  const width = 100; const height = 40; const padding = 5;
  const max = Math.max(...data); const min = Math.min(...data);
  let range = max - min;
  if (range === 0) range = 1;

  const getY = (val: number) => {
    if (max === 0) return height - padding;
    if (max === min) return height / 2;
    return height - padding - ((val - min) / range) * (height - padding * 2);
  };
  const getX = (index: number) => (index / (data.length - 1)) * width;
  const points = data.map((val, i) => `${getX(i)},${getY(val)}`).join(' ');
  const fillPath = `M 0,${height} L 0,${getY(data[0])} ${points.split(' ').map((p, _) => `L ${p}`).join(' ')} L ${width},${getY(data[data.length - 1])} L ${width},${height} Z`;
  const gradientId = `gradient-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={getY(data[data.length - 1])} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
};

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export const DoraScorecard = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const doraMetricsApi = useApi(doraMetricsApiRef);
  const serviceName = entity.metadata.name;

  const [data, setData] = useState<DoraResponse | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editTargets, setEditTargets] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const json = await doraMetricsApi.getScorecard(serviceName, 30);
      setData(json);

      setEditTargets({
        deploymentFrequency: json.metrics?.deploymentFrequency?.target ?? 7,
        leadTime: json.metrics?.leadTime?.target ?? 24,
        changeFailureRate: json.metrics?.changeFailureRate?.target ?? 5,
        mttr: json.metrics?.mttr?.target ?? 60,
      });
    } catch (e: any) {
      console.error('Failed to load DORA data:', e);
      setError(e.message);
    }
  };

  useEffect(() => { loadData(); }, [serviceName]);

  const handleSaveTargets = async () => {
    try {
      const payload = {
        deploymentFrequency: Number(editTargets.deploymentFrequency || 0),
        leadTime: Number(editTargets.leadTime || 0),
        changeFailureRate: Number(editTargets.changeFailureRate || 0),
        mttr: Number(editTargets.mttr || 0),
      };

      await doraMetricsApi.updateTargets(serviceName, payload);
      setOpenDialog(false);
      loadData();
    } catch (e) {
      alert('Failed to save targets');
    }
  };

  const renderProgress = (current: number, target: number, lowerIsBetter: boolean) => {
    let progress = 0;
    let isMet = false;

    if (target === 0) {
      if (lowerIsBetter) {
        isMet = current === 0;
        progress = isMet ? 100 : 0;
      } else {
        isMet = true;
        progress = 100;
      }
    } else {
      if (lowerIsBetter) {
        isMet = current <= target;
        progress = isMet ? 100 : (target / current) * 100;
      } else {
        isMet = current >= target;
        progress = Math.min((current / target) * 100, 100);
      }
    }

    if (!isFinite(progress) || isNaN(progress)) progress = 0;

    const label = isMet ? "Goal Met" : `${progress.toFixed(0)}%`;
    const color = isMet ? "primary" : "secondary";

    return (
      <Box mt={1}>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="textSecondary">Target: {target}</Typography>
          <Typography
            variant="caption"
            color={isMet ? "primary" : "textSecondary"}
            style={{fontWeight: isMet ? 'bold' : 'normal'}}
          >
            {label}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          className={classes.progressBar}
          color={color}
        />
      </Box>
    );
  };

  const handleInputChange = (field: string, value: string) => {
    setEditTargets((prev: any) => ({
      ...prev,
      [field]: value === '' ? '' : Number(value)
    }));
  };

  if (error) return <Typography color="error">Failed to load metrics: {error}</Typography>;
  if (!data) return <LinearProgress />;

  return (
    <>
      <Card className={classes.root}>
        <CardHeader
          title="DORA Metrics"
          action={
            <Box display="flex" alignItems="center">
              <Chip
                label={`Score: ${data.overallScore}`}
                color={data.overallScore > 70 ? 'primary' : 'default'}
                style={{ margin: 5, fontWeight: 'bold' }}
              />
              <Button startIcon={<SettingsIcon />} size="small" onClick={() => setOpenDialog(true)}>
                Targets
              </Button>
            </Box>
          }
        />
        <CardContent className={classes.content}>
          <Grid container spacing={2}>
            {/* 1. Freq (High is Better) */}
            <Grid item xs={12} sm={6} md={3} style={{ display: 'flex' }}>
              <MetricCard
                title="Freq" val={data.metrics.deploymentFrequency.current} unit="/week"
                tier={data.metrics.deploymentFrequency.tier}
                history={data.metrics.deploymentFrequency.history}
                progress={renderProgress(data.metrics.deploymentFrequency.current, data.metrics.deploymentFrequency.target, false)}
              />
            </Grid>
            {/* 2. Lead Time (Lower is Better) */}
            <Grid item xs={12} sm={6} md={3} style={{ display: 'flex' }}>
              <MetricCard
                title="Lead Time" val={data.metrics.leadTime.current} unit="h"
                tier={data.metrics.leadTime.tier}
                history={data.metrics.leadTime.history}
                progress={renderProgress(data.metrics.leadTime.current, data.metrics.leadTime.target, true)}
              />
            </Grid>
            {/* 3. Fail Rate (Lower is Better) */}
            <Grid item xs={12} sm={6} md={3} style={{ display: 'flex' }}>
              <MetricCard
                title="Fail Rate" val={data.metrics.changeFailureRate.current} unit="%"
                tier={data.metrics.changeFailureRate.tier}
                history={data.metrics.changeFailureRate.history}
                progress={renderProgress(data.metrics.changeFailureRate.current, data.metrics.changeFailureRate.target, true)}
              />
            </Grid>
            {/* 4. MTTR (Lower is Better) */}
            <Grid item xs={12} sm={6} md={3} style={{ display: 'flex' }}>
              <MetricCard
                title="MTTR" val={data.metrics.mttr.current} unit="min"
                tier={data.metrics.mttr.tier}
                history={data.metrics.mttr.history}
                progress={renderProgress(data.metrics.mttr.current, data.metrics.mttr.target, true)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Set Targets ({serviceName})</DialogTitle>
        <DialogContent>
          <TextField
            label="Deployment Freq (per week)" fullWidth margin="normal" type="number"
            value={editTargets.deploymentFrequency}
            onChange={(e) => handleInputChange('deploymentFrequency', e.target.value)}
            helperText="Target: 7/week (Daily)"
          />
          <TextField
            label="Lead Time (hours)" fullWidth margin="normal" type="number"
            value={editTargets.leadTime}
            onChange={(e) => handleInputChange('leadTime', e.target.value)}
            helperText="Target: 24h"
          />
          <TextField
            label="Failure Rate (%)" fullWidth margin="normal" type="number"
            value={editTargets.changeFailureRate}
            onChange={(e) => handleInputChange('changeFailureRate', e.target.value)}
            helperText="Target: 5%"
          />
          <TextField
            label="MTTR (minutes)" fullWidth margin="normal" type="number"
            value={editTargets.mttr}
            onChange={(e) => handleInputChange('mttr', e.target.value)}
            helperText="Target: 60min"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveTargets} color="primary" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

interface MetricCardProps {
  title: string; val: number; unit: string; tier: string; history: number[]; progress: React.ReactNode;
}
const MetricCard = ({ title, val, unit, tier, history, progress }: MetricCardProps) => {
  const classes = useStyles();
  const getTierColor = (t: string) => {
    if (!t) return '#9e9e9e';
    switch(t.toLowerCase()) {
      case 'elite': return '#4caf50';
      case 'high': return '#2196f3';
      case 'medium': return '#ff9800';
      case 'low': return '#f44336';
      default: return '#9e9e9e';
    }
  };
  const color = getTierColor(tier);

  return (
    <Card variant="outlined" className={classes.metricCard}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography color="textSecondary" variant="caption" style={{ textTransform: 'uppercase', fontWeight: 600 }}>{title}</Typography>
          <Chip label={tier} size="small" style={{ backgroundColor: color, color: '#fff', fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
        </Box>
        <Typography className={classes.metricValue}>{val.toFixed(1)}<span style={{ fontSize: '1rem', color: '#888', marginLeft: 4 }}>{unit}</span></Typography>
      </Box>
      <Box className={classes.chartContainer}>
        <SimpleSparkline data={history} color={color} />
      </Box>
      <Box>{progress}</Box>
    </Card>
  );
};
