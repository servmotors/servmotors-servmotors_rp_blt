import { Server as HttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { storage } from "./storage";

// Tipos de mensagens para o WebSocket
export enum MessageType {
  // Mensagens relacionadas ao motorista
  DRIVER_LOCATION_UPDATE = "driver_location_update",
  DRIVER_STATUS_UPDATE = "driver_status_update",
  
  // Mensagens relacionadas às solicitações de corrida
  RIDE_REQUEST = "ride_request",
  RIDE_REQUEST_SUCCESS = "ride_request_success",
  NEW_RIDE_REQUEST = "new_ride_request",
  RIDE_ACCEPTED = "ride_accepted",
  RIDE_REJECTED = "ride_rejected",
  RIDE_CANCELED = "ride_canceled",
  RIDE_STARTED = "ride_started",
  RIDE_COMPLETED = "ride_completed",
  
  // Mensagens de configuração em tempo real
  NEGOTIATION_SETTINGS_UPDATE = "negotiation_settings_update",
  DYNAMIC_PRICING_UPDATE = "dynamic_pricing_update",
  FEATURE_TOGGLE_UPDATE = "feature_toggle_update",
  
  // Mensagens gerais
  ERROR = "error",
  PING = "ping",
  PONG = "pong"
}

// Interface para as mensagens do WebSocket
export interface WebSocketMessage {
  type: MessageType;
  payload: any;
  senderId?: number;
  senderType?: 'driver' | 'passenger' | 'system';
  timestamp: number;
}

// Interface para os clientes conectados
interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  userType: 'driver' | 'passenger' | 'admin';
  lastActivity: number;
}

export class RealTimeServer {
  private wss: WebSocketServer;
  private clients: ConnectedClient[] = [];
  // Intervalo para verificar conexões inativas (em milissegundos)
  private readonly HEARTBEAT_INTERVAL = 30000;
  // Tempo máximo de inatividade antes de considerar a conexão como inativa (em milissegundos)
  private readonly HEARTBEAT_TIMEOUT = 60000;
  
  constructor(server: HttpServer) {
    // Inicializa o servidor WebSocket no caminho /ws para não conflitar com o HMR do Vite
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.setupWebSocketServer();
    this.setupHeartbeat();
  }
  
  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Nova conexão WebSocket');
      
      // Registrar cliente imediatamente sem autenticação complexa
      const client: ConnectedClient = {
        ws,
        userId: 0, // Será atualizado quando receber dados do usuário
        userType: 'passenger', // Padrão
        lastActivity: Date.now()
      };
      
      this.clients.push(client);
      
      // Configurar timeout de autenticação
      let authTimeout: NodeJS.Timeout | null = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendError(ws, 'Timeout de autenticação');
          ws.close();
        }
      }, 30000); // 30 segundos para autenticar
      
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Processar a autenticação do cliente ou qualquer mensagem PING
          if (data.type === 'auth' || data.type === MessageType.PING) {
            if (authTimeout) {
              clearTimeout(authTimeout);
              authTimeout = null;
            }
            
            // Extrair dados do usuário
            const { userId, userType } = data.payload || {};
            
            if (!userId || !userType) {
              this.sendError(ws, 'Dados de autenticação inválidos');
              return;
            }
            
            // Simplificar autenticação - apenas aceitar qualquer usuário válido
            let userExists = true;
            
            if (userType === 'driver') {
              const driver = await storage.getUser(userId);
              userExists = !!driver;
            } else if (userType === 'passenger') {
              const passenger = await storage.getPassenger(userId);
              userExists = !!passenger;
            }
            
            if (!userExists) {
              this.sendError(ws, 'Usuário não encontrado');
              return;
            }
            
            // Registrar o cliente autenticado
            const client: ConnectedClient = {
              ws,
              userId,
              userType,
              lastActivity: Date.now()
            };
            
            // Remover qualquer conexão existente com o mesmo userId e userType
            this.clients = this.clients.filter(c => 
              !(c.userId === userId && c.userType === userType)
            );
            
            this.clients.push(client);
            
            console.log(`✅ Cliente autenticado: ${userType} #${userId}`);
            console.log(`📊 Total de clientes conectados: ${this.clients.length}`);
            console.log(`👥 Clientes ativos:`, this.clients.map(c => `${c.userType} #${c.userId}`));
            
            // Enviar confirmação de autenticação
            ws.send(JSON.stringify({
              type: 'auth_success',
              payload: { userId, userType },
              timestamp: Date.now()
            }));
            
            // Se for um motorista, iniciar o rastreamento de localização
            if (userType === 'driver') {
              // Verificar se o motorista já tem uma localização registrada
              const location = await storage.getDriverLocationByDriverId(userId);
              
              if (location) {
                // Atualizar o status do motorista para disponível, se não estiver em corrida
                await storage.updateDriverLocation(userId, { 
                  status: location.currentRideId ? 'busy' : 'available'
                });
              } else {
                // Criar uma localização padrão para o motorista (será atualizada pelo cliente)
                await storage.createDriverLocation({
                  driverId: userId,
                  latitude: 0,
                  longitude: 0,
                  status: 'offline'
                });
              }
            }
            
            return;
          }
          
          // Verificar se o cliente está autenticado
          const clientIndex = this.clients.findIndex(client => client.ws === ws);
          if (clientIndex === -1) {
            this.sendError(ws, 'Cliente não autenticado');
            return;
          }
          
          // Atualizar o timestamp da última atividade
          this.clients[clientIndex].lastActivity = Date.now();
          
          // Processar as mensagens de acordo com o tipo
          this.handleMessage(data, this.clients[clientIndex]);
        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
          this.sendError(ws, 'Erro ao processar mensagem');
        }
      });
      
      ws.on('close', () => {
        console.log('Conexão WebSocket fechada');
        
        // Limpar timeout de autenticação se ainda existir
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        
        // Encontrar o cliente que desconectou
        const clientIndex = this.clients.findIndex(client => client.ws === ws);
        
        if (clientIndex !== -1) {
          const { userId, userType } = this.clients[clientIndex];
          
          // Se for um motorista, atualizar o status para offline
          if (userType === 'driver') {
            storage.updateDriverLocation(userId, { 
              status: 'offline'
            }).catch(err => {
              console.error(`Erro ao atualizar status do motorista #${userId} para offline:`, err);
            });
          }
          
          // Remover o cliente da lista
          this.clients.splice(clientIndex, 1);
        }
      });
      
      ws.on('error', (err) => {
        console.error('Erro na conexão WebSocket:', err);
      });
    });
  }
  
  private setupHeartbeat() {
    // Verificar conexões inativas periodicamente
    setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, index) => {
        if (now - client.lastActivity > this.HEARTBEAT_TIMEOUT) {
          console.log(`Cliente inativo: ${client.userType} #${client.userId}`);
          
          // Fechar a conexão inativa
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close();
          }
          
          // Remover o cliente da lista
          this.clients.splice(index, 1);
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }
  
  private async handleMessage(data: any, client: ConnectedClient) {
    try {
      switch (data.type) {
        case MessageType.DRIVER_LOCATION_UPDATE:
          await this.handleDriverLocationUpdate(data.payload, client);
          break;
          
        case MessageType.DRIVER_STATUS_UPDATE:
          await this.handleDriverStatusUpdate(data.payload, client);
          break;
          
        case MessageType.RIDE_REQUEST:
          console.log(`🔄 Processando RIDE_REQUEST de ${client.userType} #${client.userId}`, data.payload);
          await this.handleRideRequest(data.payload, client);
          break;
          
        case MessageType.RIDE_ACCEPTED:
          await this.handleRideAccepted(data.payload, client);
          break;
          
        case MessageType.RIDE_STARTED:
          await this.handleRideStarted(data.payload, client);
          break;
          
        case MessageType.RIDE_COMPLETED:
          await this.handleRideCompleted(data.payload, client);
          break;
          
        case MessageType.RIDE_CANCELED:
          await this.handleRideCanceled(data.payload, client);
          break;
          
        case MessageType.PING:
          this.sendMessage(client.ws, MessageType.PONG, {});
          break;
          
        default:
          console.warn(`Tipo de mensagem não reconhecido: ${data.type}`);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      this.sendError(client.ws, 'Erro interno do servidor');
    }
  }
  
  private async handleDriverLocationUpdate(payload: any, client: ConnectedClient) {
    if (client.userType !== 'driver') {
      this.sendError(client.ws, 'Apenas motoristas podem atualizar localização');
      return;
    }
    
    const { latitude, longitude, heading, speed, accuracy, status } = payload;
    
    try {
      await storage.updateDriverLocation(client.userId, {
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
        status
      });
      
      // Verificar se o motorista tem uma corrida ativa
      const driverLocation = await storage.getDriverLocationByDriverId(client.userId);
      
      if (driverLocation?.currentRideId) {
        // Se tem uma corrida ativa, buscar detalhes da corrida
        const ride = await storage.getRideById(driverLocation.currentRideId);
        
        if (ride && ride.userId) {
          // Notificar o passageiro sobre a localização atualizada do motorista
          this.broadcastToUser(ride.userId, 'passenger', MessageType.DRIVER_LOCATION_UPDATE, {
            driverId: client.userId,
            latitude,
            longitude,
            heading,
            speed,
            accuracy,
            rideId: driverLocation.currentRideId
          });
        }
      }
      
      console.log(`Localização do motorista #${client.userId} atualizada`);
    } catch (error) {
      console.error('Erro ao atualizar localização do motorista:', error);
      this.sendError(client.ws, 'Erro ao atualizar localização');
    }
  }
  
  private async handleDriverStatusUpdate(payload: any, client: ConnectedClient) {
    if (client.userType !== 'driver') {
      this.sendError(client.ws, 'Apenas motoristas podem atualizar status');
      return;
    }
    
    const { status } = payload;
    
    try {
      await storage.updateDriverLocation(client.userId, { status });
      console.log(`Status do motorista #${client.userId} atualizado para: ${status}`);
    } catch (error) {
      console.error('Erro ao atualizar status do motorista:', error);
      this.sendError(client.ws, 'Erro ao atualizar status');
    }
  }
  
  private async handleRideRequest(payload: any, client: ConnectedClient) {
    // Permitir teste para motoristas também
    if (client.userType !== 'passenger' && client.userType !== 'driver') {
      this.sendError(client.ws, 'Apenas passageiros e motoristas podem solicitar corridas');
      return;
    }
    
    // Se for um motorista testando, apenas simular notificação sem criar no banco
    if (client.userType === 'driver') {
      console.log(`🧪 Teste de notificação iniciado pelo motorista #${client.userId}`);
      this.simulateRideRequestForTesting(payload, client);
      return;
    }
    
    try {
      // Criar a solicitação de corrida na tabela rideRequests
      const rideRequestData = {
        passengerId: client.userId,
        status: 'pending',
        originLatitude: payload.originLatitude,
        originLongitude: payload.originLongitude,
        originAddress: payload.originAddress,
        destinationLatitude: payload.destinationLatitude,
        destinationLongitude: payload.destinationLongitude,
        destinationAddress: payload.destinationAddress,
        estimatedDistance: payload.estimatedDistance,
        estimatedDuration: payload.estimatedDuration,
        estimatedPrice: payload.estimatedPrice,
        requestTime: new Date()
      };
      
      const rideRequest = await storage.createRideRequest(rideRequestData);
      
      // Buscar motoristas disponíveis próximos
      const availableDrivers = await storage.getAvailableDriversNearLocation(
        payload.originLatitude,
        payload.originLongitude,
        10000 // 10km de raio
      );
      
      console.log(`✅ Solicitação de corrida criada: ID ${rideRequest.id}`);
      console.log(`🚗 Motoristas disponíveis encontrados: ${availableDrivers.length}`);
      
      // Se não há motoristas disponíveis, criar dados de teste
      if (availableDrivers.length === 0) {
        console.log(`⚠️ Nenhum motorista disponível encontrado, notificando todos os motoristas conectados como teste`);
        // Notificar todos os motoristas conectados independente do status
        const driverClients = this.clients.filter(c => c.userType === 'driver');
        console.log(`👥 Motoristas conectados via WebSocket: ${driverClients.length}`);
        
        // Buscar dados reais do passageiro
        const passenger = await storage.getPassenger(client.userId);
        const passengerName = passenger?.fullName || `Passageiro #${client.userId}`;
        const passengerPhone = passenger?.phoneNumber || '(00) 00000-0000';
        
        driverClients.forEach(driverClient => {
          console.log(`📢 Notificando motorista conectado #${driverClient.userId} sobre nova corrida #${rideRequest.id}`);
          
          this.sendMessage(driverClient.ws, MessageType.NEW_RIDE_REQUEST, {
            id: rideRequest.id,
            passengerId: client.userId,
            passengerName: passengerName,
            passengerPhone: passengerPhone,
            pickupAddress: payload.originAddress,
            destinationAddress: payload.destinationAddress,
            pickupLatitude: payload.originLatitude,
            pickupLongitude: payload.originLongitude,
            destinationLatitude: payload.destinationLatitude,
            destinationLongitude: payload.destinationLongitude,
            estimatedDistance: payload.estimatedDistance,
            estimatedDuration: payload.estimatedDuration,
            estimatedPrice: payload.estimatedPrice,
            requestTime: new Date().toISOString(),
            status: 'pending'
          });
        });
      } else {
        // Buscar dados reais do passageiro para motoristas disponíveis
        const passenger = await storage.getPassenger(client.userId);
        const passengerName = passenger?.fullName || `Passageiro #${client.userId}`;
        const passengerPhone = passenger?.phoneNumber || '(00) 00000-0000';
        
        // Notificar motoristas disponíveis normalmente
        availableDrivers.forEach(driver => {
          console.log(`📢 Notificando motorista #${driver.driverId} sobre nova corrida #${rideRequest.id}`);
          
          this.broadcastToUser(driver.driverId, 'driver', MessageType.NEW_RIDE_REQUEST, {
            id: rideRequest.id,
            passengerId: client.userId,
            passengerName: passengerName,
            passengerPhone: passengerPhone,
            pickupAddress: payload.originAddress,
            destinationAddress: payload.destinationAddress,
            pickupLatitude: payload.originLatitude,
            pickupLongitude: payload.originLongitude,
            destinationLatitude: payload.destinationLatitude,
            destinationLongitude: payload.destinationLongitude,
            estimatedDistance: payload.estimatedDistance,
            estimatedDuration: payload.estimatedDuration,
            estimatedPrice: payload.estimatedPrice,
            requestTime: new Date().toISOString(),
            status: 'pending'
          });
        });
      }
      
      // Confirmar para o passageiro que a solicitação foi criada
      this.sendMessage(client.ws, MessageType.RIDE_REQUEST, {
        success: true,
        rideId: rideRequest.id,
        message: 'Solicitação de corrida criada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao processar solicitação de corrida:', error);
      this.sendError(client.ws, 'Erro ao criar solicitação de corrida');
    }
  }
  
  private simulateRideRequestForTesting(payload: any, client: ConnectedClient) {
    // Criar dados simulados para teste
    const testRideRequest = {
      id: Date.now(), // ID único baseado em timestamp
      passengerId: 999999, // ID de teste
      passengerName: 'Passageiro Teste',
      passengerPhone: '(19) 99999-9999',
      originAddress: payload.originAddress,
      destinationAddress: payload.destinationAddress,
      estimatedDistance: payload.estimatedDistance,
      estimatedDuration: payload.estimatedDuration,
      estimatedPrice: payload.estimatedPrice,
      requestTime: new Date().toISOString(),
      notes: payload.notes || 'Solicitação de teste'
    };
    
    console.log(`🧪 Simulando notificação de corrida para todos os motoristas conectados`);
    
    // Notificar todos os motoristas conectados
    this.clients.forEach(connectedClient => {
      if (connectedClient.userType === 'driver' && connectedClient.ws.readyState === 1) {
        console.log(`📱 Enviando notificação de teste para motorista #${connectedClient.userId}`);
        
        this.sendMessage(connectedClient.ws, MessageType.NEW_RIDE_REQUEST, {
          rideRequest: testRideRequest,
          distance: payload.estimatedDistance || 5.2,
          estimatedArrival: payload.estimatedDuration || 15
        });
      }
    });
    
    // Confirmar sucesso para o cliente que iniciou o teste
    this.sendMessage(client.ws, MessageType.RIDE_REQUEST_SUCCESS, {
      success: true,
      rideId: testRideRequest.id,
      message: 'Teste de notificação enviado com sucesso'
    });
    
    console.log(`✅ Teste de notificação concluído - ${this.getDriverCount()} motoristas notificados`);
  }
  
  private getDriverCount(): number {
    return this.clients.filter(client => client.userType === 'driver' && client.ws.readyState === 1).length;
  }
  
  private async handleRideAccepted(payload: any, client: ConnectedClient) {
    if (client.userType !== 'driver') {
      this.sendError(client.ws, 'Apenas motoristas podem aceitar corridas');
      return;
    }
    
    const { rideRequestId } = payload;
    
    try {
      // Buscar a corrida
      const ride = await storage.getRideById(rideRequestId);
      
      if (!ride) {
        this.sendError(client.ws, 'Corrida não encontrada');
        return;
      }
      
      if (ride.status !== 'pending') {
        this.sendError(client.ws, 'Esta corrida não está mais disponível');
        return;
      }
      
      // Verificar se o motorista não está em outra corrida
      const driverLocation = await storage.getDriverLocationByDriverId(client.userId);
      
      if (driverLocation?.currentRideId) {
        this.sendError(client.ws, 'Você já está em uma corrida ativa');
        return;
      }
      
      // Atualizar a corrida com o motorista
      await storage.updateRide(rideRequestId, {
        driverId: client.userId,
        status: 'accepted'
      });
      
      // Atualizar a localização do motorista com a corrida atual
      await storage.updateDriverLocation(client.userId, {
        currentRideId: rideRequestId,
        status: 'busy'
      });
      
      console.log(`Corrida #${rideRequestId} aceita pelo motorista #${client.userId}`);
      
      // Notificar o passageiro que a corrida foi aceita
      if (ride.userId) {
        this.broadcastToUser(ride.userId, 'passenger', MessageType.RIDE_ACCEPTED, {
          rideId: rideRequestId,
          driverId: client.userId,
          message: 'Sua corrida foi aceita por um motorista'
        });
      }
      
      // Notificar outros motoristas que a corrida não está mais disponível
      this.broadcastToUserType('driver', MessageType.RIDE_REJECTED, {
        rideId: rideRequestId,
        message: 'Esta corrida foi aceita por outro motorista'
      }, [client.userId]);
      
      // Confirmar para o motorista que aceitou
      this.sendMessage(client.ws, MessageType.RIDE_ACCEPTED, {
        success: true,
        rideRequestId,
        message: 'Corrida aceita com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao aceitar corrida:', error);
      this.sendError(client.ws, 'Erro ao aceitar corrida');
    }
  }
  
  private async handleRideStarted(payload: any, client: ConnectedClient) {
    if (client.userType !== 'driver') {
      this.sendError(client.ws, 'Apenas motoristas podem iniciar corridas');
      return;
    }
    
    const { rideRequestId } = payload;
    
    try {
      // Buscar a corrida
      const ride = await storage.getRideById(rideRequestId);
      
      if (!ride) {
        this.sendError(client.ws, 'Corrida não encontrada');
        return;
      }
      
      if (ride.driverId !== client.userId) {
        this.sendError(client.ws, 'Você não está atribuído a esta corrida');
        return;
      }
      
      if (ride.status !== 'accepted') {
        this.sendError(client.ws, 'Esta corrida não pode ser iniciada');
        return;
      }
      
      // Atualizar o status da corrida
      await storage.updateRide(rideRequestId, {
        status: 'active',
        startTime: new Date()
      });
      
      console.log(`Corrida #${rideRequestId} iniciada pelo motorista #${client.userId}`);
      
      // Notificar o passageiro que a corrida foi iniciada
      if (ride.userId) {
        this.broadcastToUser(ride.userId, 'passenger', MessageType.RIDE_STARTED, {
          rideId: rideRequestId,
          driverId: client.userId,
          message: 'Sua corrida foi iniciada'
        });
      }
      
      // Confirmar para o motorista
      this.sendMessage(client.ws, MessageType.RIDE_STARTED, {
        success: true,
        rideRequestId,
        message: 'Corrida iniciada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao iniciar corrida:', error);
      this.sendError(client.ws, 'Erro ao iniciar corrida');
    }
  }
  
  private async handleRideCompleted(payload: any, client: ConnectedClient) {
    if (client.userType !== 'driver') {
      this.sendError(client.ws, 'Apenas motoristas podem completar corridas');
      return;
    }
    
    const { rideRequestId } = payload;
    
    try {
      // Buscar a corrida
      const ride = await storage.getRideById(rideRequestId);
      
      if (!ride) {
        this.sendError(client.ws, 'Corrida não encontrada');
        return;
      }
      
      if (ride.driverId !== client.userId) {
        this.sendError(client.ws, 'Você não está atribuído a esta corrida');
        return;
      }
      
      if (ride.status !== 'active') {
        this.sendError(client.ws, 'Esta corrida não está ativa');
        return;
      }
      
      // Atualizar o status da corrida
      await storage.updateRide(rideRequestId, {
        status: 'completed',
        endTime: new Date()
      });
      
      // Liberar o motorista
      await storage.updateDriverLocation(client.userId, {
        currentRideId: null,
        status: 'available'
      });
      
      console.log(`Corrida #${rideRequestId} completada pelo motorista #${client.userId}`);
      
      // Notificar o passageiro que a corrida foi completada
      if (ride.userId) {
        this.broadcastToUser(ride.userId, 'passenger', MessageType.RIDE_COMPLETED, {
          rideId: rideRequestId,
          driverId: client.userId,
          price: ride.amount,
          message: 'Sua corrida foi completada'
        });
      }
      
      // Confirmar para o motorista
      this.sendMessage(client.ws, MessageType.RIDE_COMPLETED, {
        success: true,
        rideRequestId,
        message: 'Corrida completada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao completar corrida:', error);
      this.sendError(client.ws, 'Erro ao completar corrida');
    }
  }
  
  private async handleRideCanceled(payload: any, client: ConnectedClient) {
    const { rideRequestId, reason } = payload;
    
    try {
      // Buscar a corrida
      const ride = await storage.getRideById(rideRequestId);
      
      if (!ride) {
        this.sendError(client.ws, 'Corrida não encontrada');
        return;
      }
      
      // Verificar se o usuário pode cancelar a corrida
      if (client.userType === 'passenger' && ride.userId !== client.userId) {
        this.sendError(client.ws, 'Você não pode cancelar esta corrida');
        return;
      }
      
      if (client.userType === 'driver' && ride.driverId !== client.userId) {
        this.sendError(client.ws, 'Você não pode cancelar esta corrida');
        return;
      }
      
      // Atualizar o status da corrida
      await storage.updateRide(rideRequestId, {
        status: 'canceled'
      });
      
      // Se havia um motorista atribuído, liberar ele
      if (ride.driverId) {
        await storage.updateDriverLocation(ride.driverId, {
          currentRideId: null,
          status: 'available'
        });
      }
      
      console.log(`Corrida #${rideRequestId} cancelada por ${client.userType} #${client.userId}`);
      
      // Notificar a outra parte sobre o cancelamento
      if (client.userType === 'passenger' && ride.driverId) {
        this.broadcastToUser(ride.driverId, 'driver', MessageType.RIDE_CANCELED, {
          rideId: rideRequestId,
          canceledBy: 'passenger',
          reason,
          message: 'Corrida cancelada pelo passageiro'
        });
      } else if (client.userType === 'driver' && ride.userId) {
        this.broadcastToUser(ride.userId, 'passenger', MessageType.RIDE_CANCELED, {
          rideId: rideRequestId,
          canceledBy: 'driver',
          reason,
          message: 'Corrida cancelada pelo motorista'
        });
      }
      
      // Confirmar para quem cancelou
      this.sendMessage(client.ws, MessageType.RIDE_CANCELED, {
        success: true,
        rideRequestId,
        message: 'Corrida cancelada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao cancelar corrida:', error);
      this.sendError(client.ws, 'Erro ao cancelar corrida');
    }
  }
  
  // Métodos auxiliares
  private sendMessage(ws: WebSocket, type: MessageType, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type,
        payload,
        timestamp: Date.now()
      }));
    }
  }
  
  private sendError(ws: WebSocket, message: string) {
    this.sendMessage(ws, MessageType.ERROR, { message });
  }
  
  private broadcastToUser(userId: number, userType: string, type: MessageType, payload: any) {
    const clients = this.clients.filter(client => 
      client.userId === userId && client.userType === userType
    );
    
    console.log(`🔔 Tentando enviar mensagem para ${userType} #${userId}: ${type}`);
    console.log(`📱 Clientes conectados encontrados: ${clients.length}`);
    console.log(`👥 Total de clientes ativos: ${this.clients.length}`);
    
    if (clients.length === 0) {
      console.log(`⚠️ Nenhum cliente ${userType} #${userId} conectado`);
    }
    
    clients.forEach(client => {
      console.log(`📤 Enviando mensagem para ${userType} #${userId}`);
      this.sendMessage(client.ws, type, payload);
    });
  }
  
  private broadcastToUserType(userType: string, type: MessageType, payload: any, excludeUsers: number[] = []) {
    const clients = this.clients.filter(client => 
      client.userType === userType && !excludeUsers.includes(client.userId)
    );
    
    clients.forEach(client => {
      this.sendMessage(client.ws, type, payload);
    });
  }
  
  // Métodos públicos para broadcasting
  public broadcastFeatureToggleUpdate(featureName: string, isEnabled: boolean) {
    const payload = { featureName, isEnabled };
    this.clients.forEach(client => {
      this.sendMessage(client.ws, MessageType.FEATURE_TOGGLE_UPDATE, payload);
    });
  }
  
  public broadcastNegotiationSettingsUpdate(settings: any) {
    this.clients.forEach(client => {
      this.sendMessage(client.ws, MessageType.NEGOTIATION_SETTINGS_UPDATE, settings);
    });
  }
  
  public broadcastDynamicPricingUpdate(pricingData: any) {
    this.clients.forEach(client => {
      this.sendMessage(client.ws, MessageType.DYNAMIC_PRICING_UPDATE, pricingData);
    });
  }
}