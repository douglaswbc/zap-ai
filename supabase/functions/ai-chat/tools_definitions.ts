export const tools = [
    {
        type: "function",
        function: {
            name: "list_services",
            description: "Lista todos os serviços e preços da empresa.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "list_professionals",
            description: "Lista os profissionais disponíveis.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_available_slots",
            description: "Busca horários disponíveis para um profissional em uma data.",
            parameters: {
                type: "object",
                properties: {
                    professional_id: { type: "string", description: "ID (UUID) do profissional obtido em list_professionals" },
                    service_id: { type: "string", description: "ID (UUID) do serviço obtido em list_services" },
                    date: { type: "string", description: "Formato YYYY-MM-DD" }
                },
                required: ["professional_id", "service_id", "date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_appointment",
            description: "Realiza o agendamento de um serviço.",
            parameters: {
                type: "object",
                properties: {
                    service_id: { type: "string", description: "ID (UUID) extraído em list_services" },
                    professional_id: { type: "string", description: "ID (UUID) extraído em list_professionals" },
                    date: { type: "string" },
                    time: { type: "string", description: "Formato HH:mm" }
                },
                required: ["service_id", "professional_id", "date", "time"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_payment",
            description: "Gera um código PIX para pagamento de um agendamento.",
            parameters: {
                type: "object",
                properties: {
                    appointment_id: { type: "string" }
                },
                required: ["appointment_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "check_payment_status",
            description: "Verifica se o pagamento de um agendamento foi confirmado.",
            parameters: {
                type: "object",
                properties: {
                    appointment_id: { type: "string" }
                },
                required: ["appointment_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_my_appointments",
            description: "Consulta os agendamentos realizados pelo usuário atual (focando em agendamentos hoje e futuros).",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "cancel_appointment",
            description: "Cancela um agendamento existente.",
            parameters: {
                type: "object",
                properties: {
                    appointment_id: { type: "string", description: "ID (UUID) do agendamento a ser cancelado" }
                },
                required: ["appointment_id"]
            }
        }
    }
];
